"""IA v2 recommendations evidence + rescan endpoints.

Scaffold-only. Prefix `/recommendations-v2` chosen to avoid collisions with
the existing `/recommendations` router; the v2 frontend will move to these
paths when persistence lands.
"""

import uuid
from datetime import datetime, timezone, timedelta
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException

from numio.core.auth import AuthenticatedUser, get_current_user
from numio.schemas.ia_v2_recommendations_evidence import (
    EvidenceAffectedSample,
    EvidenceManualRemediation,
    EvidenceRisk,
    RecommendationEvidence,
    RescanRequest,
    RescanResponse,
    RiskLevel,
)

router = APIRouter(prefix="/recommendations-v2", tags=["ia-v2-recommendations"])

_LAST_RESCAN: dict[str, datetime] = {}
_DEDUPE_WINDOW = timedelta(minutes=15)


@router.get(
    "/{recommendation_id}/evidence",
    response_model=RecommendationEvidence,
    summary="Get evidence model for a recommendation",
)
async def get_evidence(
    recommendation_id: str,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> RecommendationEvidence:
    if recommendation_id == "missing":
        raise HTTPException(status_code=404, detail="Recommendation not found")
    return RecommendationEvidence(
        recommendation_id=recommendation_id,
        signals=[
            "142 resources averaged <2% CPU for 14 consecutive nights (8pm–6am local).",
            "Tagged owners' last activity > 9 days ago.",
            "No active incidents or PR pushes affecting these resources in the last 14 days.",
            "Tag Governance flagged 6 production-adjacent resources — auto-excluded.",
        ],
        sample=[
            EvidenceAffectedSample(name="ml-train-worker-04", svc="EC2", type="g5.12xlarge", spend=Decimal("3120"), idle="14/14 nights"),
            EvidenceAffectedSample(name="data-eda-3", svc="EC2", type="m6i.4xlarge", spend=Decimal("980"), idle="14/14 nights"),
            EvidenceAffectedSample(name="k8s-dev-cluster-2", svc="EKS", type="t3.large × 8", spend=Decimal("620"), idle="13/14 nights"),
            EvidenceAffectedSample(name="analytics-dev-warehouse", svc="Redshift", type="ra3.xl × 2", spend=Decimal("480"), idle="14/14 nights"),
            EvidenceAffectedSample(name="jupyter-dev-04", svc="EC2", type="m6i.2xlarge", spend=Decimal("324"), idle="14/14 nights"),
        ],
        affected_count=142,
        remaining_count=137,
        remaining_spend=Decimal("6296"),
        what_happens=[
            "Stops EC2 / EKS / Redshift instances at 8pm local time when CPU has been <2% for 4+ hours.",
            "Resumes on next PR push to the resource's repository or at 6am local — whichever comes first.",
            "Reversible: any user can manually resume from the dashboard. Volumes and data are preserved.",
        ],
        exclusions="6 resources tagged production-adjacent by Tag Governance are excluded from this rule.",
        risk=EvidenceRisk(
            level=RiskLevel.low,
            text="No production traffic on affected fleet. Worst case: cold-start delay on resume (≈45s for EC2, ≈2min for EKS).",
        ),
        manual_remediation=EvidenceManualRemediation(
            note="Prefer Send to Autopilot for nightly enforcement. To apply once manually:",
            cmd='$ numio actions hibernate \\\n    --filter "env IN (dev,sandbox) AND cpu < 2% for 4h" \\\n    --exclude "tag:criticality = production-adjacent" \\\n    --dry-run',
        ),
        generated_at=datetime.now(timezone.utc),
    )


@router.post("/rescan", response_model=RescanResponse, summary="Trigger a fresh recommendations scan")
async def trigger_rescan(
    body: RescanRequest,
    current_user: AuthenticatedUser = Depends(get_current_user),
) -> RescanResponse:
    key = body.idempotency_key or f"{current_user.workspace_id}:default"
    now = datetime.now(timezone.utc)
    last = _LAST_RESCAN.get(key)
    if last and (now - last) < _DEDUPE_WINDOW:
        return RescanResponse(job_id=f"rescan-{key}", started_at=last, deduped=True)
    _LAST_RESCAN[key] = now
    return RescanResponse(
        job_id=f"rescan-{uuid.uuid4()}",
        started_at=now,
        deduped=False,
    )
