#!/usr/bin/env python3
"""Run once: creates the SQLite database and verifies all dependencies."""
import sqlite3, os, sys

DB_FILE = os.path.expanduser('~/.openclaw/leads.db')

print("Checking dependencies...")
missing = []
for pkg, install_name in [('flask','flask'),('pytz','pytz'),('sklearn','scikit-learn'),
                           ('numpy','numpy'),('gspread','gspread'),('requests','requests')]:
    try:
        __import__(pkg)
        print(f"  ✓ {pkg}")
    except ImportError:
        print(f"  ✗ {pkg}  →  pip3 install {install_name}")
        missing.append(install_name)

if missing:
    print(f"\nRun: pip3 install {' '.join(missing)}")
    sys.exit(1)

print(f"\nCreating database at {DB_FILE} ...")
db = sqlite3.connect(DB_FILE)
db.executescript("""
CREATE TABLE IF NOT EXISTS leads (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    place_id        TEXT    UNIQUE NOT NULL,
    name            TEXT    NOT NULL,
    phone           TEXT    DEFAULT '',
    category        TEXT    DEFAULT '',
    area            TEXT    DEFAULT '',
    address         TEXT    DEFAULT '',
    rating          REAL,
    review_count    INTEGER,
    date_found      TEXT,
    score           REAL    DEFAULT 0.5,
    status          TEXT    DEFAULT 'new',
    call_attempts   INTEGER DEFAULT 0,
    last_called     TEXT,
    next_call_after TEXT,
    notes           TEXT    DEFAULT '',
    created_at      TEXT    DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS calls (
    id               INTEGER PRIMARY KEY AUTOINCREMENT,
    lead_id          INTEGER NOT NULL,
    vapi_call_id     TEXT,
    started_at       TEXT,
    ended_at         TEXT,
    duration_seconds INTEGER DEFAULT 0,
    outcome          TEXT    DEFAULT 'pending',
    interested       INTEGER DEFAULT 0,
    transcript       TEXT    DEFAULT '',
    sentiment        REAL,
    FOREIGN KEY (lead_id) REFERENCES leads(id)
);

CREATE INDEX IF NOT EXISTS idx_leads_status    ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score     ON leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_place_id  ON leads(place_id);
CREATE INDEX IF NOT EXISTS idx_leads_next_call ON leads(next_call_after);
CREATE INDEX IF NOT EXISTS idx_calls_vapi_id   ON calls(vapi_call_id);
CREATE INDEX IF NOT EXISTS idx_calls_lead_id   ON calls(lead_id);
""")
db.commit()
count = db.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
db.close()

print(f"  ✓ Database ready  ({count} existing leads)")
print("\nAll good. Fill in ~/.openclaw/config.json then load the LaunchAgents:")
print("  launchctl load ~/Library/LaunchAgents/com.openclaw.webhook_server.plist")
print("  launchctl load ~/Library/LaunchAgents/com.openclaw.call_leads.plist")
print("  launchctl load ~/Library/LaunchAgents/com.openclaw.watchdog.plist")
print("  launchctl load ~/Library/LaunchAgents/com.openclaw.score_leads.plist")
