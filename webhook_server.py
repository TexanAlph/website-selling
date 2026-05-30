#!/usr/bin/env python3
"""
Webhook server — receives Vapi call events, updates DB + Google Sheet,
fires push notifications when a lead is interested.
Runs as a persistent service on port 5000.
"""
import sqlite3, json, os, requests, logging, sys
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
import gspread
from google.oauth2.service_account import Credentials

sys.path.insert(0, os.path.expanduser('~'))
import score_leads  # for partial_update online learning

CONFIG_FILE          = os.path.expanduser('~/.openclaw/config.json')
DB_FILE              = os.path.expanduser('~/.openclaw/leads.db')
LOG_FILE             = os.path.expanduser('~/webhook_log.txt')
SERVICE_ACCOUNT_FILE = os.path.expanduser('~/.openclaw/service-account.json')
SHEET_ID             = '1WASU7JWtL-lDxLBlQMpIHw67A6-vMFYg7R6lV_XJNL4'

logging.basicConfig(
    filename=LOG_FILE, level=logging.INFO,
    format='%(asctime)s [WEBHOOK] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger()

app = Flask(__name__)


def load_config():
    with open(CONFIG_FILE) as f:
        return json.load(f)


def get_sheet():
    creds = Credentials.from_service_account_file(
        SERVICE_ACCOUNT_FILE,
        scopes=['https://www.googleapis.com/auth/spreadsheets']
    )
    return gspread.authorize(creds).open_by_key(SHEET_ID).sheet1


def notify(config, title, body, priority='high'):
    topic = config.get('notifications', {}).get('ntfy_topic', '')
    if not topic or 'CHANGE-THIS' in topic:
        return
    try:
        requests.post(
            f'https://ntfy.sh/{topic}',
            data=body.encode('utf-8'),
            headers={'Title': title, 'Priority': priority, 'Tags': 'telephone'},
            timeout=10
        )
    except Exception as e:
        log.warning(f"Push notification failed: {e}")


def update_sheet(place_id, status, extra_note=''):
    """Find the row by scanning for place_id, update Status and optionally Notes."""
    try:
        sheet = get_sheet()
        rows  = sheet.get_all_values()
        for i, row in enumerate(rows[1:], start=2):
            if place_id in row:
                sheet.update_cell(i, 8, status)  # Column H = Status
                if extra_note:
                    current_note = row[4] if len(row) > 4 else ''
                    combined = f"{current_note} | {extra_note}".strip(' |')
                    sheet.update_cell(i, 5, combined)  # Column E = Notes
                return
    except Exception as e:
        log.error(f"Sheet update failed ({place_id}): {e}")


# ── Interest signals for fallback transcript analysis ───────────────────────
INTEREST_PHRASES = [
    'yes', 'sure', 'interested', 'sounds good', 'tell me more',
    'send me', 'email me', 'how much', '$599', 'go ahead',
    'let\'s do it', 'sign me up', 'i\'d like', 'i want'
]


@app.route('/vapi-webhook', methods=['POST'])
def vapi_webhook():
    data     = request.get_json(silent=True) or {}
    msg      = data.get('message', {})
    msg_type = msg.get('type', '')

    call_info = msg.get('call', {})
    vapi_id   = call_info.get('id', '')
    metadata  = call_info.get('metadata', {})
    lead_id   = metadata.get('lead_id')
    place_id  = metadata.get('place_id', '')

    log.info(f"Event: {msg_type}  vapi_id={vapi_id}  lead_id={lead_id}")

    config = load_config()
    db     = sqlite3.connect(DB_FILE)
    db.row_factory = sqlite3.Row

    try:
        # ── Tool call: mark_interested ───────────────────────────────────────
        if msg_type == 'tool-calls':
            for tc in msg.get('toolCallList', []):
                fn   = tc.get('function', {})
                name = fn.get('name', '')
                try:
                    args = json.loads(fn.get('arguments', '{}'))
                except Exception:
                    args = {}

                if name == 'mark_interested' and lead_id:
                    email = args.get('email', '')
                    notes = args.get('notes', '')
                    note_str = ' | '.join(filter(None, [f'Email: {email}' if email else '', notes]))

                    db.execute(
                        "UPDATE leads SET status='interested', notes=? WHERE id=?",
                        (note_str, lead_id)
                    )
                    db.commit()

                    lead = db.execute("SELECT * FROM leads WHERE id=?", (lead_id,)).fetchone()
                    if lead:
                        update_sheet(place_id, 'Interested 🔥', note_str)
                        notify(config,
                            '🔥 Hot Lead!',
                            f"{lead['name']}\n{lead['phone']}\n{note_str or 'Wants a website!'}"
                        )
                        log.info(f"INTERESTED: {lead['name']} | {lead['phone']} | {note_str}")

            # Always return 200 with empty results so Vapi doesn't retry
            return jsonify({"results": [{"toolCallId": tc.get("id"), "result": "ok"}
                                        for tc in msg.get('toolCallList', [])]})

        # ── End of call report ───────────────────────────────────────────────
        elif msg_type == 'end-of-call-report':
            ended_reason = call_info.get('endedReason', '')
            transcript   = call_info.get('transcript', '')
            duration     = int(call_info.get('duration', 0))

            if ended_reason in ('no-answer', 'no-answer-machine'):
                outcome = 'no_answer'
            elif ended_reason == 'voicemail':
                outcome = 'voicemail'
            elif ended_reason in ('busy-signal',):
                outcome = 'busy'
            else:
                outcome = 'completed'

            db.execute("""
                UPDATE calls SET ended_at=?, duration_seconds=?, outcome=?, transcript=?
                WHERE  vapi_call_id=?
            """, (datetime.utcnow().isoformat(), duration, outcome, transcript, vapi_id))

            if lead_id:
                lead = db.execute("SELECT * FROM leads WHERE id=?", (lead_id,)).fetchone()
                if lead and lead['status'] != 'interested':
                    if outcome in ('no_answer', 'voicemail', 'busy'):
                        attempts = lead['call_attempts']
                        max_att  = config['calling']['max_attempts']
                        if attempts >= max_att:
                            db.execute("UPDATE leads SET status='exhausted' WHERE id=?", (lead_id,))
                            update_sheet(place_id, 'No Answer (exhausted)')
                        else:
                            # Retry at a different time — stagger by attempt number
                            delay_hours = [4, 24, 48][min(attempts, 2)]
                            next_call   = (datetime.utcnow() + timedelta(hours=delay_hours)).isoformat()
                            db.execute(
                                "UPDATE leads SET status='no_answer', next_call_after=? WHERE id=?",
                                (next_call, lead_id)
                            )
                            update_sheet(place_id, f'No Answer (retry in {delay_hours}h)')
                    else:
                        # Completed call — fallback transcript interest check
                        t_lower = transcript.lower()
                        if any(phrase in t_lower for phrase in INTEREST_PHRASES):
                            db.execute("UPDATE leads SET status='maybe' WHERE id=?", (lead_id,))
                            update_sheet(place_id, 'Maybe — Review Transcript')
                            notify(config, '👀 Possible Interest',
                                   f"{lead['name']} — review transcript in calls_log")
                        else:
                            db.execute("UPDATE leads SET status='not_interested' WHERE id=?", (lead_id,))
                            update_sheet(place_id, 'Not Interested')

            db.commit()

            # Online learning: update model immediately with this outcome
            if lead_id:
                final_status = db.execute(
                    "SELECT status FROM leads WHERE id=?", (lead_id,)
                ).fetchone()
                if final_status:
                    try:
                        score_leads.partial_update(int(lead_id), final_status[0])
                    except Exception as e:
                        log.warning(f"Online learning update failed: {e}")

            log.info(f"Call ended: {ended_reason}  duration={duration}s  outcome={outcome}")

    finally:
        db.close()

    return jsonify({"status": "ok"})


@app.route('/health', methods=['GET'])
def health():
    return jsonify({"status": "ok", "time": datetime.utcnow().isoformat()})


if __name__ == '__main__':
    log.info("Webhook server starting on port 5000")
    app.run(host='0.0.0.0', port=5000, debug=False)
