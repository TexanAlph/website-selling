#!/usr/bin/env python3
"""
Watchdog — checks system health every 10 min, restarts services if needed,
pushes a notification if anything is broken for too long.
"""
import requests, sqlite3, json, os, subprocess, logging
from datetime import datetime, timedelta

CONFIG_FILE = os.path.expanduser('~/.openclaw/config.json')
DB_FILE     = os.path.expanduser('~/.openclaw/leads.db')
LOG_FILE    = os.path.expanduser('~/watchdog_log.txt')

logging.basicConfig(
    filename=LOG_FILE, level=logging.INFO,
    format='%(asctime)s [WATCHDOG] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger()


def load_config():
    with open(CONFIG_FILE) as f:
        return json.load(f)


def check_webhook_server():
    try:
        r = requests.get('http://localhost:5000/health', timeout=5)
        return r.status_code == 200
    except Exception:
        return False


def restart_service(label):
    try:
        subprocess.run(
            ['launchctl', 'kickstart', '-k', f'gui/{os.getuid()}/{label}'],
            capture_output=True, timeout=10
        )
        log.info(f"Restarted {label}")
        return True
    except Exception as e:
        log.error(f"Could not restart {label}: {e}")
        return False


def check_db():
    try:
        db = sqlite3.connect(DB_FILE, timeout=5)
        db.execute("SELECT COUNT(*) FROM leads").fetchone()
        db.close()
        return True
    except Exception:
        return False


def check_lead_freshness():
    """Returns True if leads have been found within the last 26 hours."""
    try:
        db = sqlite3.connect(DB_FILE, timeout=5)
        result = db.execute("SELECT MAX(created_at) FROM leads").fetchone()[0]
        db.close()
        if not result:
            return True  # Empty DB — not an error, just starting out
        last = datetime.fromisoformat(result)
        return (datetime.utcnow() - last) < timedelta(hours=26)
    except Exception:
        return True  # Don't false-alarm if DB can't be read


def notify(config, title, body, priority='urgent'):
    topic = config.get('notifications', {}).get('ntfy_topic', '')
    if not topic or 'CHANGE-THIS' in topic:
        return
    try:
        requests.post(
            f'https://ntfy.sh/{topic}',
            data=body.encode('utf-8'),
            headers={'Title': title, 'Priority': priority, 'Tags': 'warning'},
            timeout=10
        )
    except Exception:
        pass


def main():
    try:
        config = load_config()
    except Exception as e:
        log.error(f"Could not load config: {e}")
        return

    issues = []

    # Webhook server
    if not check_webhook_server():
        log.warning("Webhook server DOWN — restarting")
        restart_service('com.openclaw.webhook_server')
        import time; time.sleep(3)
        if not check_webhook_server():
            issues.append("Webhook server is down and failed to restart")
        else:
            log.info("Webhook server recovered")
    else:
        log.info("Webhook server: OK")

    # Database
    if not check_db():
        issues.append("Database inaccessible")
        log.error("Database: FAIL")
    else:
        log.info("Database: OK")

    # Lead freshness (find_leads.py ran recently)
    if not check_lead_freshness():
        issues.append("No new leads found in 26h — find_leads.py may have failed")
        log.warning("Lead freshness: STALE")
    else:
        log.info("Lead freshness: OK")

    if issues:
        msg = "Issues detected:\n" + "\n".join(f"• {i}" for i in issues)
        notify(config, "⚠️ OpenClaw Alert", msg)
        log.error(f"ALERT: {msg}")
    else:
        log.info("All systems healthy")


if __name__ == '__main__':
    main()
