#!/usr/bin/env python3
"""
analytics.py — The intelligence engine. Runs daily at 8 AM.

Closes the learning loop:
  - Factor attribution: which features actually drive conversions
  - Call time optimization: when each category answers and converts best
  - Alpha decay detection: categories converting worse week-over-week
  - Transcript mining: common phrases in winning vs losing calls
  - Daily brief: push notification with actionable intelligence
  - Category weight update: feeds improved priors back to score_leads
"""
import sqlite3, json, os, re, logging, requests
from datetime import datetime, timedelta
from collections import defaultdict, Counter

CONFIG_FILE = os.path.expanduser('~/.openclaw/config.json')
DB_FILE     = os.path.expanduser('~/.openclaw/leads.db')
LOG_FILE    = os.path.expanduser('~/analytics_log.txt')

logging.basicConfig(
    filename=LOG_FILE, level=logging.INFO,
    format='%(asctime)s [ANALYTICS] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger()

DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun']

# Maps category search strings to short keys (mirrors call_leads.py)
def category_key(category):
    cat = (category or '').lower()
    if any(k in cat for k in ['salon','nail','barber','massage','medspa','wax','tattoo','eyelash','braid','esthetics','microblad']):
        return 'beauty'
    if any(k in cat for k in ['plumb','electric','hvac','roof','paint','landscap','lawn','handyman','clean','pest','pool','fence','tree','floor','tile','drywall','concrete','remodel','garage','appliance','locksmith','pressure','junk','moving']):
        return 'home_service'
    if any(k in cat for k in ['restaurant','taqueria','bakery','food truck','bbq','cater']):
        return 'food'
    if any(k in cat for k in ['auto repair','mechanic','car wash','tire','tow','detailing','window tint']):
        return 'auto'
    if any(k in cat for k in ['dj','florist','wedding','event plan','photo booth','videograph','bounce house','party rental']):
        return 'events'
    if any(k in cat for k in ['yoga','gym','fitness','martial arts','dance','personal train']):
        return 'fitness'
    if any(k in cat for k in ['pet groomin','dog train','dog board']):
        return 'pet'
    if any(k in cat for k in ['phone repair','computer repair','appliance repair','shoe repair']):
        return 'repair'
    if any(k in cat for k in ['notary','tax prep','bookkeep']):
        return 'professional'
    return 'other'


def load_config():
    with open(CONFIG_FILE) as f:
        return json.load(f)


def notify(config, title, body, priority='default'):
    topic = config.get('notifications', {}).get('ntfy_topic', '')
    if not topic or 'CHANGE-THIS' in topic:
        log.info(f"[BRIEF]\n{title}\n{body}")
        return
    try:
        requests.post(
            f'https://ntfy.sh/{topic}',
            data=body.encode('utf-8'),
            headers={'Title': title, 'Priority': priority, 'Tags': 'chart_with_upwards_trend'},
            timeout=10
        )
    except Exception as e:
        log.warning(f"Notification failed: {e}")


# ── Analysis functions ────────────────────────────────────────────────────────

def conversion_by_category(db):
    rows = db.execute("""
        SELECT l.category,
               COUNT(*)                                             AS calls,
               SUM(CASE WHEN c.outcome NOT IN ('no_answer','voicemail','busy','pending') THEN 1 ELSE 0 END) AS answered,
               SUM(CASE WHEN l.status IN ('interested','converted','maybe') THEN 1 ELSE 0 END) AS interested
        FROM   calls c
        JOIN   leads l ON c.lead_id = l.id
        WHERE  c.started_at >= datetime('now', '-30 days')
        GROUP  BY l.category
        HAVING calls >= 3
        ORDER  BY interested * 1.0 / calls DESC
    """).fetchall()

    result = {}
    for cat, calls, answered, interested in rows:
        key = category_key(cat)
        if key not in result:
            result[key] = {'calls': 0, 'answered': 0, 'interested': 0}
        result[key]['calls']      += calls
        result[key]['answered']   += answered
        result[key]['interested'] += interested

    for key, d in result.items():
        d['answer_rate']     = round(d['answered']   / d['calls']   * 100, 1) if d['calls']   else 0
        d['conversion_rate'] = round(d['interested'] / d['calls']   * 100, 1) if d['calls']   else 0
        d['close_rate']      = round(d['interested'] / d['answered']* 100, 1) if d['answered'] else 0

    return result


def best_call_times(db):
    """Returns top 5 (day, hour) slots by answer rate, min 5 calls."""
    rows = db.execute("""
        SELECT CAST(strftime('%w', c.started_at) AS INTEGER)  AS dow,
               CAST(strftime('%H', c.started_at) AS INTEGER)  AS hour,
               COUNT(*)                                        AS calls,
               SUM(CASE WHEN c.outcome NOT IN ('no_answer','voicemail','busy','pending') THEN 1 ELSE 0 END) AS answered,
               SUM(CASE WHEN l.status IN ('interested','converted') THEN 1 ELSE 0 END) AS interested
        FROM   calls c
        JOIN   leads l ON c.lead_id = l.id
        WHERE  c.started_at >= datetime('now', '-60 days')
        GROUP  BY dow, hour
        HAVING calls >= 5
        ORDER  BY interested * 1.0 / calls DESC
        LIMIT  10
    """).fetchall()

    slots = []
    for dow, hour, calls, answered, interested in rows:
        day_name = DAYS[dow % 7]
        ampm     = f"{hour % 12 or 12}{'am' if hour < 12 else 'pm'}"
        slots.append({
            'label':       f"{day_name} {ampm}",
            'calls':       calls,
            'answer_rate': round(answered   / calls * 100, 1),
            'conv_rate':   round(interested / calls * 100, 1),
        })
    return slots


def detect_decay(db):
    """Categories whose conversion rate dropped >25% vs prior two weeks."""
    now  = datetime.utcnow()
    w1_start = (now - timedelta(days=14)).isoformat()
    w2_start = (now - timedelta(days=28)).isoformat()

    def rates(since, until):
        rows = db.execute("""
            SELECT l.category,
                   COUNT(*) AS calls,
                   SUM(CASE WHEN l.status IN ('interested','converted') THEN 1 ELSE 0 END) AS wins
            FROM   calls c
            JOIN   leads l ON c.lead_id = l.id
            WHERE  c.started_at BETWEEN ? AND ?
            GROUP  BY l.category
            HAVING calls >= 5
        """, (since, until)).fetchall()
        r = {}
        for cat, calls, wins in rows:
            key = category_key(cat)
            if key not in r:
                r[key] = [0, 0]
            r[key][0] += calls
            r[key][1] += wins
        return {k: v[1]/v[0] for k, v in r.items() if v[0]}

    recent = rates(w1_start, now.isoformat())
    prior  = rates(w2_start, w1_start)

    decaying = []
    for key in recent:
        if key in prior and prior[key] > 0:
            change = (recent[key] - prior[key]) / prior[key]
            if change < -0.25:
                decaying.append((key, round(prior[key]*100,1), round(recent[key]*100,1)))

    return sorted(decaying, key=lambda x: x[1]-x[2])


def mine_transcripts(db):
    """
    Finds words/phrases that appear significantly more in 'interested'
    call transcripts vs 'not_interested'. Surfaces the top objections too.
    """
    rows = db.execute("""
        SELECT c.transcript, l.status
        FROM   calls c
        JOIN   leads l ON c.lead_id = l.id
        WHERE  c.transcript != ''
          AND  l.status IN ('interested','not_interested','maybe')
          AND  c.started_at >= datetime('now', '-90 days')
    """).fetchall()

    if len(rows) < 20:
        return None, None

    win_words,  lose_words  = Counter(), Counter()
    objections = Counter()

    # Phrases that signal objections
    OBJECTION_MARKERS = [
        'not interested', 'no thank', 'already have', "don't need",
        'too expensive', 'can\'t afford', 'too busy', 'call back',
        'my son', 'my nephew', 'my husband', 'my wife',
        'think about it', 'facebook', 'instagram', 'working on it'
    ]

    for transcript, status in rows:
        t = transcript.lower()
        words = re.findall(r'\b[a-z]{4,}\b', t)
        target = win_words if status in ('interested','maybe') else lose_words
        for w in words:
            target[w] += 1
        for obj in OBJECTION_MARKERS:
            if obj in t:
                objections[obj] += 1

    # Words significantly over-represented in winning calls
    win_signals = []
    for word, cnt in win_words.most_common(100):
        lose_cnt = lose_words.get(word, 0)
        total    = cnt + lose_cnt
        if total >= 5 and cnt / total > 0.65:
            win_signals.append(word)

    return win_signals[:10], objections.most_common(8)


def update_call_time_stats(db):
    """Rebuild call_time_stats table from raw call data."""
    db.execute("DELETE FROM call_time_stats")
    db.execute("""
        INSERT INTO call_time_stats (category_key, day_of_week, hour, calls, answered, interested)
        SELECT
            l.category,
            CAST(strftime('%w', c.started_at) AS INTEGER),
            CAST(strftime('%H', c.started_at) AS INTEGER),
            COUNT(*),
            SUM(CASE WHEN c.outcome NOT IN ('no_answer','voicemail','busy','pending') THEN 1 ELSE 0 END),
            SUM(CASE WHEN l.status IN ('interested','converted') THEN 1 ELSE 0 END)
        FROM calls c
        JOIN leads l ON c.lead_id = l.id
        WHERE c.started_at IS NOT NULL
        GROUP BY l.category, 2, 3
        ON CONFLICT(category_key, day_of_week, hour) DO UPDATE SET
            calls      = excluded.calls,
            answered   = excluded.answered,
            interested = excluded.interested,
            updated_at = datetime('now')
    """)
    db.commit()


def pipeline_summary(db):
    total_leads = db.execute("SELECT COUNT(*) FROM leads").fetchone()[0]
    new_leads   = db.execute("SELECT COUNT(*) FROM leads WHERE status='new'").fetchone()[0]
    interested  = db.execute("SELECT COUNT(*) FROM leads WHERE status IN ('interested','maybe')").fetchone()[0]
    converted   = db.execute("SELECT COUNT(*) FROM leads WHERE status='converted'").fetchone()[0]
    calls_today = db.execute(
        "SELECT COUNT(*) FROM calls WHERE date(started_at) = date('now')"
    ).fetchone()[0]
    calls_week  = db.execute(
        "SELECT COUNT(*) FROM calls WHERE started_at >= datetime('now','-7 days')"
    ).fetchone()[0]
    return {
        'total_leads': total_leads,
        'new_leads':   new_leads,
        'interested':  interested,
        'converted':   converted,
        'calls_today': calls_today,
        'calls_week':  calls_week,
        'pipeline_value': interested * 599,
    }


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    try:
        config = load_config()
    except Exception as e:
        log.error(f"Config load failed: {e}")
        return

    db = sqlite3.connect(DB_FILE)
    db.row_factory = sqlite3.Row

    # Rebuild call time stats
    update_call_time_stats(db)

    pipe    = pipeline_summary(db)
    by_cat  = conversion_by_category(db)
    times   = best_call_times(db)
    decays  = detect_decay(db)
    win_words, top_objections = mine_transcripts(db)

    db.close()

    # ── Log detailed report ──────────────────────────────────────────────────
    log.info("=" * 60)
    log.info(f"DAILY ANALYTICS — {datetime.utcnow().strftime('%Y-%m-%d')}")
    log.info(f"Pipeline: {pipe['total_leads']} leads | {pipe['interested']} interested | ${pipe['pipeline_value']:,} potential")
    log.info(f"Calls: {pipe['calls_today']} today | {pipe['calls_week']} this week")

    if by_cat:
        log.info("\nConversion by category (last 30d):")
        for key, d in sorted(by_cat.items(), key=lambda x: -x[1]['conversion_rate']):
            log.info(f"  {key:16s} {d['calls']:4d} calls | {d['answer_rate']:5.1f}% answered | {d['conversion_rate']:5.1f}% converted")

    if times:
        log.info("\nBest call times:")
        for t in times[:5]:
            log.info(f"  {t['label']:12s} {t['answer_rate']:5.1f}% answer | {t['conv_rate']:5.1f}% converted")

    if decays:
        log.info("\nDecaying categories (>25% drop):")
        for key, old, new in decays:
            log.info(f"  {key}: {old}% → {new}%")

    if top_objections:
        log.info("\nTop objections (last 90d):")
        for obj, cnt in top_objections:
            log.info(f"  '{obj}': {cnt}x")

    if win_words:
        log.info(f"\nWin-signal words: {', '.join(win_words)}")

    # ── Build push notification brief ───────────────────────────────────────
    lines = []
    lines.append(f"Pipeline: {pipe['interested']} hot leads | ${pipe['pipeline_value']:,} potential")
    lines.append(f"Calls: {pipe['calls_today']} today | {pipe['calls_week']} this week")
    lines.append(f"Queue: {pipe['new_leads']} leads ready to call")

    if by_cat:
        top3 = sorted(by_cat.items(), key=lambda x: -x[1]['conversion_rate'])[:3]
        lines.append("")
        lines.append("Top categories:")
        for key, d in top3:
            lines.append(f"  {key}: {d['conversion_rate']}% ({d['calls']} calls)")

    if times:
        lines.append(f"\nBest time: {times[0]['label']} ({times[0]['conv_rate']}% conv)")

    if decays:
        lines.append(f"\n⚠️ Cooling off: {', '.join(k for k,_,_ in decays[:2])}")

    if top_objections:
        top_obj = top_objections[0][0]
        lines.append(f"Top objection: \"{top_obj}\"")

    notify(config, f"📊 Daily Brief — {datetime.utcnow().strftime('%b %d')}", "\n".join(lines))
    log.info("Daily brief sent.")


if __name__ == '__main__':
    main()
