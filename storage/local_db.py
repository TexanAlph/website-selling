"""SQLite storage on Mac Mini — shared by storage API, scraper, and media stream."""

from __future__ import annotations

import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"
DEFAULT_DB = Path(os.getenv("STORAGE_DB_PATH", Path.home() / ".web-dialer" / "dialer.db"))


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def new_id() -> str:
    return str(uuid.uuid4())


def db_path() -> Path:
    return Path(os.getenv("STORAGE_DB_PATH", DEFAULT_DB))


def connect() -> sqlite3.Connection:
    path = db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(path), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db(conn: sqlite3.Connection | None = None) -> None:
    own = conn is None
    conn = conn or connect()
    conn.executescript(SCHEMA_PATH.read_text())
    conn.commit()
    if own:
        conn.close()


def row_to_dict(row: sqlite3.Row | None) -> dict[str, Any] | None:
    if row is None:
        return None
    return {k: row[k] for k in row.keys()}


def rows_to_list(rows: list[sqlite3.Row]) -> list[dict[str, Any]]:
    return [row_to_dict(r) for r in rows]  # type: ignore[misc]


# --- Leads ---


def get_next_lead(rep: str) -> dict[str, Any] | None:
    with connect() as conn:
        init_db(conn)
        row = conn.execute(
            """
            SELECT * FROM leads
            WHERE status = 'New' AND assigned_rep = ?
            ORDER BY created_at ASC
            LIMIT 1
            """,
            (rep,),
        ).fetchone()
        return row_to_dict(row)


def count_new_leads(rep: str) -> int:
    with connect() as conn:
        init_db(conn)
        row = conn.execute(
            "SELECT COUNT(*) AS c FROM leads WHERE status = 'New' AND assigned_rep = ?",
            (rep,),
        ).fetchone()
        return int(row["c"]) if row else 0


def count_new_per_rep(reps: tuple[str, ...] = ("david", "x")) -> dict[str, int]:
    with connect() as conn:
        init_db(conn)
        out: dict[str, int] = {}
        for rep in reps:
            row = conn.execute(
                "SELECT COUNT(*) AS c FROM leads WHERE status = 'New' AND assigned_rep = ?",
                (rep,),
            ).fetchone()
            out[rep] = int(row["c"]) if row else 0
        return out


def update_lead_status(
    lead_id: str,
    status: str,
    rep: str,
    *,
    claim_only: bool = False,
) -> bool:
    now = utc_now()
    with connect() as conn:
        init_db(conn)
        if claim_only:
            cur = conn.execute(
                """
                UPDATE leads SET status = ?, status_changed_at = ?
                WHERE id = ? AND status = 'New' AND assigned_rep = ?
                """,
                (status, now, lead_id, rep),
            )
        else:
            cur = conn.execute(
                """
                UPDATE leads SET status = ?, status_changed_at = ?
                WHERE id = ? AND assigned_rep = ?
                """,
                (status, now, lead_id, rep),
            )
        conn.commit()
        return cur.rowcount > 0


def reset_stale_calling(stale_minutes: int = 30) -> int:
    cutoff = datetime.now(timezone.utc).timestamp() - stale_minutes * 60
    cutoff_iso = datetime.fromtimestamp(cutoff, tz=timezone.utc).strftime(
        "%Y-%m-%dT%H:%M:%S.%f"
    )[:-3] + "Z"
    now = utc_now()
    with connect() as conn:
        init_db(conn)
        cur = conn.execute(
            """
            UPDATE leads SET status = 'New', status_changed_at = ?
            WHERE status = 'Calling' AND status_changed_at < ?
            """,
            (now, cutoff_iso),
        )
        conn.commit()
        return cur.rowcount


def upsert_leads(rows: list[dict[str, Any]]) -> int:
    if not rows:
        return 0
    now = utc_now()
    count = 0
    with connect() as conn:
        init_db(conn)
        for row in rows:
            if not row.get("assigned_rep"):
                continue
            phone = row["phone"]
            existing = conn.execute(
                "SELECT id FROM leads WHERE phone = ?", (phone,)
            ).fetchone()
            if existing:
                conn.execute(
                    """
                    UPDATE leads SET
                      business_name = ?, website = ?, niche = ?,
                      status = COALESCE(?, status),
                      assigned_rep = COALESCE(?, assigned_rep)
                    WHERE phone = ?
                    """,
                    (
                        row["business_name"],
                        row.get("website"),
                        row.get("niche"),
                        row.get("status"),
                        row.get("assigned_rep"),
                        phone,
                    ),
                )
            else:
                conn.execute(
                    """
                    INSERT INTO leads (
                      id, business_name, phone, website, status, niche,
                      assigned_rep, status_changed_at, created_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        new_id(),
                        row["business_name"],
                        phone,
                        row.get("website"),
                        row.get("status", "New"),
                        row.get("niche"),
                        row["assigned_rep"],
                        now,
                        now,
                    ),
                )
            count += 1
        conn.commit()
    return count


def get_lead(lead_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        init_db(conn)
        row = conn.execute("SELECT * FROM leads WHERE id = ?", (lead_id,)).fetchone()
        return row_to_dict(row)


# --- Call sessions ---


def upsert_call_session(payload: dict[str, Any]) -> None:
    now = utc_now()
    sid = payload["id"]
    with connect() as conn:
        init_db(conn)
        existing = conn.execute(
            "SELECT id FROM call_sessions WHERE id = ?", (sid,)
        ).fetchone()
        if existing:
            fields = []
            values: list[Any] = []
            for key in (
                "lead_id",
                "niche",
                "call_source",
                "rep_name",
                "started_at",
                "analysis_status",
            ):
                if key in payload:
                    fields.append(f"{key} = ?")
                    values.append(payload[key])
            if fields:
                values.append(sid)
                conn.execute(
                    f"UPDATE call_sessions SET {', '.join(fields)} WHERE id = ?",
                    values,
                )
        else:
            conn.execute(
                """
                INSERT INTO call_sessions (
                  id, lead_id, niche, call_source, rep_name, started_at,
                  analysis_status, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    sid,
                    payload.get("lead_id"),
                    payload.get("niche"),
                    payload["call_source"],
                    payload.get("rep_name"),
                    payload.get("started_at", now),
                    payload.get("analysis_status", "pending"),
                    now,
                ),
            )
        conn.commit()


def get_call_session(session_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        init_db(conn)
        row = conn.execute(
            "SELECT * FROM call_sessions WHERE id = ?", (session_id,)
        ).fetchone()
        if not row:
            return None
        d = row_to_dict(row)
        if d and d.get("objections"):
            try:
                d["objections"] = json.loads(d["objections"])
            except json.JSONDecodeError:
                pass
        return d


def update_call_session(session_id: str, patch: dict[str, Any]) -> None:
    if not patch:
        return
    allowed = {
        "ended_at",
        "outcome_status",
        "duration_seconds",
        "transcript_full",
        "analysis_status",
        "summary",
        "objections",
        "rep_score",
        "recommendations",
        "opener_suggestion",
        "analyzed_at",
    }
    fields = []
    values: list[Any] = []
    for key, val in patch.items():
        if key not in allowed:
            continue
        if key == "objections" and val is not None:
            val = json.dumps(val)
        fields.append(f"{key} = ?")
        values.append(val)
    if not fields:
        return
    values.append(session_id)
    with connect() as conn:
        init_db(conn)
        conn.execute(
            f"UPDATE call_sessions SET {', '.join(fields)} WHERE id = ?",
            values,
        )
        conn.commit()


def list_pending_analysis(limit: int = 25) -> list[dict[str, Any]]:
    with connect() as conn:
        init_db(conn)
        rows = conn.execute(
            """
            SELECT id FROM call_sessions
            WHERE analysis_status = 'pending' AND ended_at IS NOT NULL
            ORDER BY ended_at ASC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
        return rows_to_list(rows)


def list_completed_sessions_since(since_iso: str) -> list[dict[str, Any]]:
    with connect() as conn:
        init_db(conn)
        rows = conn.execute(
            """
            SELECT outcome_status, niche, rep_score, summary, objections, duration_seconds
            FROM call_sessions
            WHERE ended_at >= ? AND analysis_status = 'completed'
            """,
            (since_iso,),
        ).fetchall()
        out = []
        for row in rows:
            d = row_to_dict(row)
            if d and d.get("objections"):
                try:
                    d["objections"] = json.loads(d["objections"])
                except json.JSONDecodeError:
                    pass
            out.append(d)
        return out  # type: ignore[return-value]


# --- Coach messages ---


def insert_coach_message(
    session_id: str,
    role: str,
    content: str,
    *,
    lead_id: str | None = None,
) -> dict[str, Any]:
    mid = new_id()
    now = utc_now()
    with connect() as conn:
        init_db(conn)
        conn.execute(
            """
            INSERT INTO coach_messages (id, session_id, lead_id, role, content, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (mid, session_id, lead_id, role, content, now),
        )
        conn.commit()
    return {
        "id": mid,
        "session_id": session_id,
        "lead_id": lead_id,
        "role": role,
        "content": content,
        "created_at": now,
    }


def get_latest_counter(session_id: str) -> dict[str, Any] | None:
    with connect() as conn:
        init_db(conn)
        row = conn.execute(
            """
            SELECT content FROM coach_messages
            WHERE session_id = ? AND role = 'counter'
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (session_id,),
        ).fetchone()
        return row_to_dict(row)


def list_coach_counters_since(
    session_id: str,
    since_iso: str | None = None,
) -> list[dict[str, Any]]:
    with connect() as conn:
        init_db(conn)
        if since_iso:
            rows = conn.execute(
                """
                SELECT id, role, content, created_at FROM coach_messages
                WHERE session_id = ? AND role = 'counter' AND created_at > ?
                ORDER BY created_at ASC
                """,
                (session_id, since_iso),
            ).fetchall()
        else:
            rows = conn.execute(
                """
                SELECT id, role, content, created_at FROM coach_messages
                WHERE session_id = ? AND role = 'counter'
                ORDER BY created_at ASC
                """,
                (session_id,),
            ).fetchall()
        return rows_to_list(rows)  # type: ignore[return-value]


def aggregate_transcript(session_id: str) -> str:
    with connect() as conn:
        init_db(conn)
        rows = conn.execute(
            """
            SELECT content FROM coach_messages
            WHERE session_id = ? AND role = 'transcript'
            ORDER BY created_at ASC
            """,
            (session_id,),
        ).fetchall()
    parts: list[str] = []
    last = ""
    for row in rows:
        chunk = (row["content"] or "").strip()
        if not chunk or chunk == last:
            continue
        parts.append(chunk)
        last = chunk
    return "\n".join(parts)


def list_media_lines(session_id: str, limit: int = 40) -> list[dict[str, Any]]:
    with connect() as conn:
        init_db(conn)
        rows = conn.execute(
            """
            SELECT role, content, created_at FROM coach_messages
            WHERE session_id = ? AND role IN ('transcript_prospect', 'transcript_rep')
            ORDER BY created_at ASC
            LIMIT ?
            """,
            (session_id, limit),
        ).fetchall()
        return rows_to_list(rows)  # type: ignore[return-value]


# --- Playbook ---


def get_playbook_for_niche(niche: str, limit: int = 6) -> list[dict[str, Any]]:
    niches = ["all"] if niche == "all" else [niche, "all"]
    placeholders = ",".join("?" * len(niches))
    with connect() as conn:
        init_db(conn)
        rows = conn.execute(
            f"""
            SELECT objection_pattern, winning_response, score
            FROM playbook_entries
            WHERE niche IN ({placeholders})
            ORDER BY score DESC
            LIMIT ?
            """,
            (*niches, limit),
        ).fetchall()
        return rows_to_list(rows)  # type: ignore[return-value]


def upsert_playbook_entry(
    niche: str,
    objection_pattern: str,
    winning_response: str,
    *,
    source_session_id: str | None = None,
    won: bool,
) -> None:
    now = utc_now()
    win_delta = 1 if won else 0
    loss_delta = 0 if won else 1
    with connect() as conn:
        init_db(conn)
        row = conn.execute(
            """
            SELECT id, win_count, loss_count FROM playbook_entries
            WHERE niche = ? AND objection_pattern = ?
            """,
            (niche, objection_pattern),
        ).fetchone()
        if row:
            wins = int(row["win_count"]) + win_delta
            losses = int(row["loss_count"]) + loss_delta
            score = wins / max(1, wins + losses)
            conn.execute(
                """
                UPDATE playbook_entries SET
                  winning_response = ?, win_count = ?, loss_count = ?,
                  score = ?, updated_at = ?
                WHERE id = ?
                """,
                (winning_response, wins, losses, score, now, row["id"]),
            )
        else:
            score = 1.0 if won else 0.0
            conn.execute(
                """
                INSERT INTO playbook_entries (
                  id, niche, objection_pattern, winning_response, source_session_id,
                  win_count, loss_count, score, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    new_id(),
                    niche,
                    objection_pattern,
                    winning_response,
                    source_session_id,
                    win_delta,
                    loss_delta,
                    score,
                    now,
                    now,
                ),
            )
        conn.commit()


def bump_playbook_outcomes(niche: str, outcome_status: str | None) -> None:
    if not outcome_status:
        return
    niches = ["all"] if niche == "all" else [niche, "all"]
    won = outcome_status == "Interested/Closed"
    placeholders = ",".join("?" * len(niches))
    with connect() as conn:
        init_db(conn)
        rows = conn.execute(
            f"""
            SELECT id, win_count, loss_count FROM playbook_entries
            WHERE niche IN ({placeholders})
            ORDER BY score DESC
            LIMIT 3
            """,
            tuple(niches),
        ).fetchall()
        now = utc_now()
        for row in rows:
            wins = int(row["win_count"]) + (1 if won else 0)
            losses = int(row["loss_count"]) + (0 if won else 1)
            score = wins / max(1, wins + losses)
            conn.execute(
                """
                UPDATE playbook_entries SET
                  win_count = ?, loss_count = ?, score = ?, updated_at = ?
                WHERE id = ?
                """,
                (wins, losses, score, now, row["id"]),
            )
        conn.commit()


# --- Insights / scraper / feedback ---


def get_latest_daily_insight() -> dict[str, Any] | None:
    with connect() as conn:
        init_db(conn)
        row = conn.execute(
            """
            SELECT report_date, content, created_at FROM daily_insights
            ORDER BY report_date DESC
            LIMIT 1
            """
        ).fetchone()
        if not row:
            return None
        d = row_to_dict(row)
        if d and d.get("content"):
            try:
                d["content"] = json.loads(d["content"])
            except json.JSONDecodeError:
                pass
        return d


def insert_daily_insight(report_date: str, content: dict[str, Any]) -> None:
    with connect() as conn:
        init_db(conn)
        conn.execute(
            """
            INSERT INTO daily_insights (id, report_date, content, created_at)
            VALUES (?, ?, ?, ?)
            """,
            (new_id(), report_date, json.dumps(content), utc_now()),
        )
        conn.commit()


def daily_insight_exists(report_date: str) -> bool:
    with connect() as conn:
        init_db(conn)
        row = conn.execute(
            "SELECT id FROM daily_insights WHERE report_date = ?",
            (report_date,),
        ).fetchone()
        return row is not None


def start_scraper_run() -> str:
    rid = new_id()
    now = utc_now()
    with connect() as conn:
        init_db(conn)
        conn.execute(
            """
            INSERT INTO scraper_runs (id, started_at, status, created_at)
            VALUES (?, ?, 'running', ?)
            """,
            (rid, now, now),
        )
        conn.commit()
    return rid


def finish_scraper_run(run_id: str, payload: dict[str, Any]) -> None:
    with connect() as conn:
        init_db(conn)
        conn.execute(
            """
            UPDATE scraper_runs SET
              status = ?, finished_at = ?, leads_upserted = ?,
              search_api_calls = ?, search_cache_hits = ?, error_message = ?,
              text_search_http_calls = ?, place_details_http_calls = ?,
              estimated_usd = ?
            WHERE id = ?
            """,
            (
                payload.get("status"),
                payload.get("finished_at", utc_now()),
                payload.get("leads_upserted", 0),
                payload.get("search_api_calls", 0),
                payload.get("search_cache_hits", 0),
                payload.get("error_message"),
                payload.get("text_search_http_calls", 0),
                payload.get("place_details_http_calls", 0),
                payload.get("estimated_usd"),
                run_id,
            ),
        )
        conn.commit()


def get_latest_scraper_run() -> dict[str, Any] | None:
    with connect() as conn:
        init_db(conn)
        row = conn.execute(
            """
            SELECT started_at, finished_at, status, leads_upserted, error_message,
                   text_search_http_calls, place_details_http_calls, estimated_usd
            FROM scraper_runs
            ORDER BY started_at DESC
            LIMIT 1
            """
        ).fetchone()
        return row_to_dict(row)


def insert_coach_feedback(
    session_id: str,
    rep_name: str,
    helpful: bool,
    message_id: str | None = None,
) -> None:
    with connect() as conn:
        init_db(conn)
        conn.execute(
            """
            INSERT INTO coach_feedback (id, session_id, message_id, rep_name, helpful, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (new_id(), session_id, message_id, rep_name, 1 if helpful else 0, utc_now()),
        )
        conn.commit()
