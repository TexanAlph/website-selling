#!/usr/bin/env python3
"""
REST API for Mac Mini SQLite storage — expose via Cloudflare Tunnel for Vercel dialer.

  STORAGE_API_SECRET=long-random-string
  STORAGE_API_PORT=8787
  python storage/api_server.py
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Allow `from local_db import ...` when run as script
sys.path.insert(0, str(Path(__file__).resolve().parent))

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Any

import local_db as db

load_dotenv(Path(__file__).resolve().parent.parent / "scraper" / ".env")
load_dotenv()

app = FastAPI(title="Web Dialer Storage", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET = os.getenv("STORAGE_API_SECRET", "").strip()


def require_auth(authorization: str | None = Header(default=None)) -> None:
    if not SECRET:
        raise HTTPException(503, "STORAGE_API_SECRET not configured on Mac Mini")
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Missing Bearer token")
    token = authorization[7:].strip()
    if token != SECRET:
        raise HTTPException(401, "Invalid token")


@app.on_event("startup")
def startup() -> None:
    db.init_db()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "db": str(db.db_path())}


# --- Leads ---


@app.get("/leads/next", dependencies=[Depends(require_auth)])
def leads_next(rep: str) -> dict[str, Any]:
    lead = db.get_next_lead(rep)
    count = db.count_new_leads(rep)
    return {"lead": lead, "queueCount": count}


@app.get("/leads/count", dependencies=[Depends(require_auth)])
def leads_count(rep: str) -> dict[str, int]:
    return {"queueCount": db.count_new_leads(rep)}


@app.get("/leads/recent", dependencies=[Depends(require_auth)])
def leads_recent(rep: str, limit: int = 25) -> dict[str, list]:
    capped = max(1, min(limit, 50))
    return {"leads": db.list_recent_leads(rep, capped)}


class LeadPatch(BaseModel):
    status: str
    rep: str
    claim_only: bool = False


@app.patch("/leads/{lead_id}", dependencies=[Depends(require_auth)])
def leads_patch(lead_id: str, body: LeadPatch) -> dict[str, bool]:
    ok = db.update_lead_status(
        lead_id, body.status, body.rep, claim_only=body.claim_only
    )
    if not ok:
        raise HTTPException(409, "Lead not available or already claimed")
    return {"ok": True}


@app.post("/leads/reset-stale-calling", dependencies=[Depends(require_auth)])
def reset_stale(stale_minutes: int = 30) -> dict[str, int]:
    return {"reset": db.reset_stale_calling(stale_minutes)}


class InboundCreate(BaseModel):
    from_phone: str
    call_sid: str | None = None


class InboundRecording(BaseModel):
    call_sid: str | None = None
    inbound_id: str | None = None
    recording_sid: str
    recording_url: str
    duration_seconds: int | None = None


@app.get("/inbound/missed", dependencies=[Depends(require_auth)])
def inbound_missed(limit: int = 30) -> dict[str, list]:
    capped = max(1, min(limit, 50))
    return {"calls": db.list_inbound_calls(capped)}


@app.post("/inbound", dependencies=[Depends(require_auth)])
def inbound_create(body: InboundCreate) -> dict[str, Any]:
    return db.create_inbound_call(body.from_phone, body.call_sid)


@app.post("/inbound/recording", dependencies=[Depends(require_auth)])
def inbound_recording(body: InboundRecording) -> dict[str, bool]:
    ok = db.attach_inbound_recording(
        inbound_id=body.inbound_id,
        call_sid=body.call_sid,
        recording_sid=body.recording_sid,
        recording_url=body.recording_url,
        duration_seconds=body.duration_seconds,
    )
    return {"ok": ok}


@app.patch("/inbound/{inbound_id}/listened", dependencies=[Depends(require_auth)])
def inbound_listened(inbound_id: str) -> dict[str, bool]:
    return {"ok": db.mark_inbound_listened(inbound_id)}


@app.get("/inbound/{inbound_id}", dependencies=[Depends(require_auth)])
def inbound_get(inbound_id: str) -> dict[str, Any]:
    row = db.get_inbound_call(inbound_id)
    if not row:
        raise HTTPException(404, "Inbound call not found")
    return row


@app.get("/leads/{lead_id}", dependencies=[Depends(require_auth)])
def lead_get(lead_id: str) -> dict[str, Any]:
    row = db.get_lead(lead_id)
    if not row:
        raise HTTPException(404, "Lead not found")
    return row


# --- Call sessions ---


class SessionUpsert(BaseModel):
    id: str
    lead_id: str | None = None
    niche: str | None = None
    call_source: str
    rep_name: str | None = None
    started_at: str | None = None
    analysis_status: str = "pending"


@app.post("/call-sessions", dependencies=[Depends(require_auth)])
def session_upsert(body: SessionUpsert) -> dict[str, str]:
    db.upsert_call_session(body.model_dump())
    return {"ok": "true"}


@app.get("/call-sessions/pending-analysis", dependencies=[Depends(require_auth)])
def pending_analysis(limit: int = 25) -> dict[str, Any]:
    return {"sessions": db.list_pending_analysis(limit)}


@app.get("/call-sessions/completed-since", dependencies=[Depends(require_auth)])
def completed_since(since: str) -> dict[str, Any]:
    return {"sessions": db.list_completed_sessions_since(since)}


@app.get("/call-sessions/{session_id}", dependencies=[Depends(require_auth)])
def session_get(session_id: str) -> dict[str, Any]:
    row = db.get_call_session(session_id)
    if not row:
        raise HTTPException(404, "Session not found")
    return row


@app.patch("/call-sessions/{session_id}", dependencies=[Depends(require_auth)])
def session_patch(session_id: str, patch: dict[str, Any]) -> dict[str, str]:
    db.update_call_session(session_id, patch)
    return {"ok": "true"}


# --- Coach ---


class CoachInsert(BaseModel):
    session_id: str
    role: str
    content: str
    lead_id: str | None = None


@app.post("/coach-messages", dependencies=[Depends(require_auth)])
def coach_insert(body: CoachInsert) -> dict[str, Any]:
    return db.insert_coach_message(
        body.session_id, body.role, body.content, lead_id=body.lead_id
    )


@app.get("/coach-messages/counters", dependencies=[Depends(require_auth)])
def coach_counters(session_id: str, since: str | None = None) -> dict[str, Any]:
    return {"messages": db.list_coach_counters_since(session_id, since)}


@app.get("/coach-messages/transcript-aggregate", dependencies=[Depends(require_auth)])
def transcript_agg(session_id: str) -> dict[str, str]:
    return {"transcript": db.aggregate_transcript(session_id)}


@app.get("/coach-messages/media-lines", dependencies=[Depends(require_auth)])
def media_lines(session_id: str) -> dict[str, Any]:
    return {"lines": db.list_media_lines(session_id)}


@app.get("/coach-messages/latest-counter", dependencies=[Depends(require_auth)])
def latest_counter(session_id: str) -> dict[str, Any]:
    row = db.get_latest_counter(session_id)
    return {"counter": row}


# --- Playbook ---


@app.get("/playbook", dependencies=[Depends(require_auth)])
def playbook_get(niche: str = "all", limit: int = 6) -> dict[str, Any]:
    return {"entries": db.get_playbook_for_niche(niche, limit)}


class PlaybookUpsert(BaseModel):
    niche: str
    objection_pattern: str
    winning_response: str
    source_session_id: str | None = None
    won: bool


@app.post("/playbook", dependencies=[Depends(require_auth)])
def playbook_upsert(body: PlaybookUpsert) -> dict[str, str]:
    db.upsert_playbook_entry(
        body.niche,
        body.objection_pattern,
        body.winning_response,
        source_session_id=body.source_session_id,
        won=body.won,
    )
    return {"ok": "true"}


@app.post("/playbook/bump-outcomes", dependencies=[Depends(require_auth)])
def playbook_bump(niche: str, outcome_status: str) -> dict[str, str]:
    db.bump_playbook_outcomes(niche, outcome_status)
    return {"ok": "true"}


# --- Insights / scraper / feedback ---


@app.get("/insights", dependencies=[Depends(require_auth)])
def insights() -> dict[str, Any]:
    insight = db.get_latest_daily_insight()
    scraper = db.get_latest_scraper_run()
    return {
        "dailyInsight": (
            {
                "report_date": insight["report_date"],
                "content": insight["content"],
                "created_at": insight["created_at"],
            }
            if insight
            else None
        ),
        "lastScraperRun": scraper,
    }


class DailyInsightInsert(BaseModel):
    report_date: str
    content: dict[str, Any]


@app.post("/daily-insights", dependencies=[Depends(require_auth)])
def daily_insert(body: DailyInsightInsert) -> dict[str, str]:
    if db.daily_insight_exists(body.report_date):
        return {"ok": "exists"}
    db.insert_daily_insight(body.report_date, body.content)
    return {"ok": "true"}


@app.get("/daily-insights/exists", dependencies=[Depends(require_auth)])
def daily_exists(report_date: str) -> dict[str, bool]:
    return {"exists": db.daily_insight_exists(report_date)}


@app.get("/scraper-runs/latest", dependencies=[Depends(require_auth)])
def scraper_latest() -> dict[str, Any]:
    return {"run": db.get_latest_scraper_run()}


class FeedbackInsert(BaseModel):
    session_id: str
    message_id: str | None = None
    rep_name: str
    helpful: bool


@app.post("/coach-feedback", dependencies=[Depends(require_auth)])
def feedback_insert(body: FeedbackInsert) -> dict[str, str]:
    db.insert_coach_feedback(
        body.session_id, body.rep_name, body.helpful, body.message_id
    )
    return {"ok": "true"}


def main() -> None:
    import uvicorn

    port = int(os.getenv("STORAGE_API_PORT", "8787"))
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="info")


if __name__ == "__main__":
    main()
