"""IA v2 Policies CRUD + bulk update."""

import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.schemas.ia_v2_policies import (
    BulkPolicyAction,
    BulkPolicyRequest,
    BulkPolicyResponse,
    CreatePolicyRequest,
    Policy,
    PolicyListResponse,
    PolicyMode,
    PolicyType,
    UpdatePolicyRequest,
)

router = APIRouter(prefix="/policies", tags=["ia-v2-policies"])

_POLICIES: dict[str, Policy] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _seed_if_empty(workspace_id: uuid.UUID) -> None:
    if _POLICIES:
        return
    seeds = [
        ("p-1", "Required tags on production resources", PolicyType.tag_governance, PolicyMode.block, True, 6),
        ("p-2", "PR cost regression guard", PolicyType.ci_guard, PolicyMode.block, True, 1),
        ("p-3", "Region lock — production data", PolicyType.placement, PolicyMode.warn, True, 0),
        ("p-4", "GPU instance approval", PolicyType.approval, PolicyMode.block, True, 0),
        ("p-5", "Auto-delete unattached EBS after 30 days", PolicyType.lifecycle, PolicyMode.auto, True, 38),
        ("p-6", "Disallow public S3 buckets in prod", PolicyType.security, PolicyMode.block, True, 0),
        ("p-7", "AI model spend caps", PolicyType.ai_governance, PolicyMode.warn, False, 2),
    ]
    for id_, name, ptype, mode, enabled, violations in seeds:
        _POLICIES[id_] = Policy(
            id=id_,
            workspace_id=workspace_id,
            name=name,
            type=ptype,
            mode=mode,
            enabled=enabled,
            violations=violations,
            last_changed=_now(),
        )


@router.get("", response_model=PolicyListResponse, summary="List policies")
async def list_policies(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> PolicyListResponse:
    _seed_if_empty(current_user.workspace_id)
    policies = list(_POLICIES.values())
    return PolicyListResponse(
        policies=policies,
        total_count=len(policies),
        open_violations_total=sum(p.violations for p in policies),
    )


@router.post("", response_model=Policy, status_code=201, summary="Create a policy")
async def create_policy(
    body: CreatePolicyRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Policy:
    policy_id = f"p-{uuid.uuid4()}"
    policy = Policy(
        id=policy_id,
        workspace_id=current_user.workspace_id,
        name=body.name,
        description=body.description,
        type=body.type,
        mode=body.mode,
        scope=body.scope,
        enabled=body.enabled,
        violations=0,
        last_changed=_now(),
    )
    _POLICIES[policy_id] = policy
    return policy


@router.patch("/{policy_id}", response_model=Policy, summary="Update a policy")
async def update_policy(
    policy_id: str,
    body: UpdatePolicyRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> Policy:
    policy = _POLICIES.get(policy_id)
    if not policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    updates = body.model_dump(exclude_unset=True)
    policy = policy.model_copy(update={**updates, "last_changed": _now()})
    _POLICIES[policy_id] = policy
    return policy


@router.delete("/{policy_id}", status_code=204, summary="Delete a policy")
async def delete_policy(
    policy_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> None:
    if policy_id not in _POLICIES:
        raise HTTPException(status_code=404, detail="Policy not found")
    del _POLICIES[policy_id]


@router.post("/bulk", response_model=BulkPolicyResponse, summary="Bulk enable / disable / change mode")
async def bulk_policy(
    body: BulkPolicyRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> BulkPolicyResponse:
    accepted = 0
    errors: list[str] = []
    for policy_id in body.policy_ids:
        policy = _POLICIES.get(policy_id)
        if not policy:
            errors.append(f"{policy_id}: not found")
            continue
        if body.action == BulkPolicyAction.enable:
            _POLICIES[policy_id] = policy.model_copy(update={"enabled": True, "last_changed": _now()})
        elif body.action == BulkPolicyAction.disable:
            _POLICIES[policy_id] = policy.model_copy(update={"enabled": False, "last_changed": _now()})
        elif body.action == BulkPolicyAction.change_mode:
            if not body.target_mode:
                errors.append(f"{policy_id}: change_mode requires target_mode")
                continue
            _POLICIES[policy_id] = policy.model_copy(update={"mode": body.target_mode, "last_changed": _now()})
        accepted += 1
    return BulkPolicyResponse(
        action=body.action,
        accepted=accepted,
        rejected=len(body.policy_ids) - accepted,
        errors=errors,
    )
