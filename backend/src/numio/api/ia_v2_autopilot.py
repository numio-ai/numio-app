"""IA v2 Autopilot rules CRUD + history + undo + pause-all + dry-run.

Scaffold-only. State stored in module-level dicts to keep the contract
real-looking (CRUD round-trips work) without a DB migration. Real
persistence is a follow-up; the contract is the deliverable.
"""

import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.schemas.ia_v2_autopilot import (
    AutopilotAction,
    AutopilotHistoryResponse,
    AutopilotRule,
    AutopilotRuleListResponse,
    CreateAutopilotRuleRequest,
    DryRunResponse,
    HistoryOutcome,
    PauseAllRequest,
    PauseAllResponse,
    RuleState,
    UndoState,
    UpdateAutopilotRuleRequest,
)

router = APIRouter(prefix="/autopilot", tags=["ia-v2-autopilot"])

_RULES: dict[str, AutopilotRule] = {}
_PAUSED_ALL: dict[uuid.UUID, datetime] = {}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _seed_if_empty(workspace_id: uuid.UUID) -> None:
    if _RULES:
        return
    base = [
        ("rule-hibernate-dev", "Hibernate dev/sandbox nightly", "Stops <2% CPU instances 8pm–6am", "Daily · 8pm local", 7, Decimal("2710")),
        ("rule-pr-cost-guard", "PR cost guard", "Blocks merges projecting > 20% cost regression", "On PR open", 14, Decimal("4310")),
        ("rule-reclaim-ebs", "Reclaim unattached EBS", "Snapshots + deletes volumes idle > 30 days", "Daily · 2am UTC", 4, Decimal("612")),
    ]
    now = _now()
    for id_, name, desc, sched, runs, saved in base:
        _RULES[id_] = AutopilotRule(
            id=id_,
            workspace_id=workspace_id,
            name=name,
            description=desc,
            schedule=sched,
            state=RuleState.active,
            archived=False,
            runs_7d=runs,
            saved_7d=saved,
            last_run="2h ago",
            dsl=[{"kw": "WHEN", "expr": "placeholder"}],
            created_at=now,
            updated_at=now,
        )


@router.get("/rules", response_model=AutopilotRuleListResponse, summary="List Autopilot rules")
async def list_rules(
    include_archived: bool = False,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AutopilotRuleListResponse:
    _seed_if_empty(current_user.workspace_id)
    rules = [r for r in _RULES.values() if include_archived or not r.archived]
    return AutopilotRuleListResponse(rules=rules, total_count=len(rules))


@router.post("/rules", response_model=AutopilotRule, status_code=201, summary="Create an Autopilot rule")
async def create_rule(
    body: CreateAutopilotRuleRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AutopilotRule:
    now = _now()
    rule_id = f"rule-{uuid.uuid4()}"
    rule = AutopilotRule(
        id=rule_id,
        workspace_id=current_user.workspace_id,
        name=body.name,
        description=body.description,
        schedule=body.schedule,
        state=RuleState.paused if body.dry_run else RuleState.active,
        archived=False,
        runs_7d=0,
        saved_7d=Decimal("0"),
        last_run=None,
        dsl=body.dsl,
        created_at=now,
        updated_at=now,
    )
    _RULES[rule_id] = rule
    return rule


@router.patch("/rules/{rule_id}", response_model=AutopilotRule, summary="Update a rule")
async def update_rule(
    rule_id: str,
    body: UpdateAutopilotRuleRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AutopilotRule:
    rule = _RULES.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    updates = body.model_dump(exclude_unset=True)
    rule = rule.model_copy(update={**updates, "updated_at": _now()})
    _RULES[rule_id] = rule
    return rule


@router.post("/rules/{rule_id}/archive", response_model=AutopilotRule, summary="Archive a rule")
async def archive_rule(
    rule_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AutopilotRule:
    rule = _RULES.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    rule = rule.model_copy(update={"archived": True, "state": RuleState.paused, "updated_at": _now()})
    _RULES[rule_id] = rule
    return rule


@router.delete("/rules/{rule_id}", status_code=204, summary="Delete a rule (archived only)")
async def delete_rule(
    rule_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> None:
    rule = _RULES.get(rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    if not rule.archived:
        raise HTTPException(status_code=409, detail="Archive before delete")
    del _RULES[rule_id]


@router.post("/rules/{rule_id}/dry-run", response_model=DryRunResponse, summary="Dry-run a rule")
async def dry_run_rule(
    rule_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> DryRunResponse:
    if rule_id not in _RULES:
        raise HTTPException(status_code=404, detail="Rule not found")
    return DryRunResponse(
        rule_id=rule_id,
        would_act_on=["i-0a4f8c2d", "i-0fc7b21e", "vol-079b3f12"],
        would_save=Decimal("1240"),
        safety_warnings=[],
    )


@router.get("/history", response_model=AutopilotHistoryResponse, summary="List action history")
async def list_history(
    rule_id: str | None = None,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> AutopilotHistoryResponse:
    now = _now()
    sample = [
        AutopilotAction(
            id="ah-1",
            when=now - timedelta(hours=1),
            rule_id="rule-hibernate-dev",
            rule="Hibernate dev/sandbox nightly",
            target="12 EC2 instances · dev fleet",
            outcome=HistoryOutcome.stopped,
            saved=Decimal("980"),
            undo_state=UndoState.within,
            undo_label="23h left",
        ),
        AutopilotAction(
            id="ah-2",
            when=now - timedelta(hours=12),
            rule_id="rule-pr-cost-guard",
            rule="PR cost guard advisory",
            target="github://data/etl#1142",
            outcome=HistoryOutcome.advised,
            saved=Decimal("0"),
            undo_state=UndoState.advisory,
        ),
        AutopilotAction(
            id="ah-3",
            when=now - timedelta(days=8),
            rule_id="rule-archive-logs",
            rule="Archive logs to Glacier",
            target="logs-bucket-prod",
            outcome=HistoryOutcome.stopped,
            saved=Decimal("240"),
            undo_state=UndoState.expired,
        ),
    ]
    if rule_id:
        sample = [a for a in sample if a.rule_id == rule_id]
    return AutopilotHistoryResponse(actions=sample, total_count=len(sample))


@router.post("/history/{action_id}/undo", status_code=200, summary="Undo an action within its window")
async def undo_action(
    action_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> dict:
    return {"action_id": action_id, "undone": True, "at": _now().isoformat()}


@router.post("/pause-all", response_model=PauseAllResponse, summary="Pause all rules atomically")
async def pause_all(
    body: PauseAllRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> PauseAllResponse:
    _seed_if_empty(current_user.workspace_id)
    affected = 0
    for rule_id, rule in _RULES.items():
        if rule.state == RuleState.active and not rule.archived:
            _RULES[rule_id] = rule.model_copy(update={"state": RuleState.paused, "updated_at": _now()})
            affected += 1
    now = _now()
    _PAUSED_ALL[current_user.workspace_id] = now
    return PauseAllResponse(paused_all=True, affected_rule_count=affected, paused_at=now)


@router.post("/resume-all", response_model=PauseAllResponse, summary="Resume all paused rules")
async def resume_all(
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> PauseAllResponse:
    affected = 0
    for rule_id, rule in _RULES.items():
        if rule.state == RuleState.paused and not rule.archived:
            _RULES[rule_id] = rule.model_copy(update={"state": RuleState.active, "updated_at": _now()})
            affected += 1
    _PAUSED_ALL.pop(current_user.workspace_id, None)
    return PauseAllResponse(paused_all=False, affected_rule_count=affected, paused_at=None)
