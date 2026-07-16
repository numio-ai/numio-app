"""Pydantic schemas for IA v2 Inbox unread-count + finding ack."""

from datetime import datetime

from pydantic import BaseModel


class InboxBadgeResponse(BaseModel):
    unread_count: int
    triage_count: int
    critical_count: int
    fetched_at: datetime


class AckFindingResponse(BaseModel):
    finding_id: str
    acknowledged: bool
    new_unread_count: int
