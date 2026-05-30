#!/usr/bin/env python3
"""
Lead scorer — updates priority scores in the DB.
Phase 1 (<100 outcomes): heuristic based on category + rating + reviews
Phase 2 (100–499 outcomes): logistic regression trained on call history
Phase 3 (500+ outcomes): gradient boosting

Runs every Sunday at 2 AM via launchd (full retrain).
Also called by webhook_server after EVERY call for online learning (partial_update).
"""
import sqlite3, os, logging, json
from datetime import datetime

DB_FILE    = os.path.expanduser('~/.openclaw/leads.db')
MODEL_FILE = os.path.expanduser('~/.openclaw/score_model.pkl')
LOG_FILE   = os.path.expanduser('~/score_log.txt')

logging.basicConfig(
    filename=LOG_FILE, level=logging.INFO,
    format='%(asctime)s [SCORER] %(message)s', datefmt='%Y-%m-%d %H:%M:%S'
)
log = logging.getLogger()

# ── Heuristic base scores by category keyword ───────────────────────────────
CATEGORY_BASE = {
    'eyelash': 0.82, 'nail salon': 0.81, 'microblad': 0.80, 'permanent makeup': 0.80,
    'hair braid': 0.78, 'waxing': 0.77, 'beauty salon': 0.76, 'barber': 0.72,
    'pet groomin': 0.76, 'dog train': 0.72, 'dog board': 0.70,
    'dj': 0.81, 'wedding photo': 0.78, 'florist': 0.76, 'event plan': 0.75,
    'photo booth': 0.74, 'videograph': 0.73, 'wedding plan': 0.75,
    'photography': 0.74, 'tattoo': 0.68,
    'massage': 0.67, 'medspa': 0.70, 'esthetics': 0.70, 'skin care': 0.70,
    'yoga': 0.70, 'pilates': 0.70, 'martial arts': 0.67, 'dance': 0.68,
    'music lesson': 0.71, 'tutoring': 0.68, 'driving school': 0.65,
    'taqueria': 0.72, 'bakery': 0.71, 'food truck': 0.67, 'catering': 0.66,
    'cleaning': 0.66, 'pressure wash': 0.57, 'carpet clean': 0.63,
    'landscap': 0.61, 'lawn': 0.60, 'tree service': 0.58, 'junk removal': 0.58,
    'handyman': 0.66, 'painting': 0.62, 'flooring': 0.62, 'tile': 0.60,
    'remodel': 0.61, 'drywall': 0.56, 'concrete': 0.54, 'fence': 0.57,
    'pest control': 0.57, 'pool': 0.60, 'hvac': 0.57, 'roofing': 0.52,
    'electrician': 0.55, 'plumber': 0.55, 'locksmith': 0.60,
    'auto detail': 0.65, 'window tint': 0.64, 'phone repair': 0.66,
    'computer repair': 0.62, 'shoe repair': 0.60,
    'alterations': 0.63, 'dry clean': 0.55, 'notary': 0.60,
    'tax prep': 0.61, 'bookkeep': 0.55, 'screen print': 0.60,
}


def heuristic_score(category, rating, review_count):
    cat = (category or '').lower()
    base = 0.50
    for keyword, score in CATEGORY_BASE.items():
        if keyword in cat:
            base = score
            break

    # Rating: 3.5–4.5 sweet spot (established but not already crushing it online)
    if rating:
        r = float(rating)
        if   3.5 <= r <= 4.5: base += 0.08
        elif r > 4.5:          base += 0.03
        elif r < 3.0:          base -= 0.08

    # Review count: 10–100 = established small business
    if review_count:
        rc = int(review_count)
        if   10 <= rc <= 100: base += 0.08
        elif rc < 5:          base -= 0.04
        elif rc > 250:        base -= 0.04
        else:                 base += 0.04

    return round(max(0.01, min(0.99, base)), 4)


def train_and_score(db, leads):
    """Attempt ML scoring. Returns dict {lead_id: score} or None to fall back to heuristic."""
    try:
        import numpy as np
        from sklearn.preprocessing import LabelEncoder
        from sklearn.linear_model import LogisticRegression
        from sklearn.ensemble import GradientBoostingClassifier
        import pickle

        rows = db.execute("""
            SELECT l.category, l.rating, l.review_count,
                   CAST(strftime('%w', c.started_at) AS INTEGER) AS dow,
                   CAST(strftime('%H', c.started_at) AS INTEGER) AS hour,
                   CASE WHEN l.status IN ('interested','converted','maybe') THEN 1 ELSE 0 END AS label
            FROM   calls c
            JOIN   leads l ON c.lead_id = l.id
            WHERE  c.outcome = 'completed'
        """).fetchall()

        n = len(rows)
        if n < 100:
            log.info(f"Only {n} completed calls — using heuristic scoring")
            return None

        categories = [r[0] for r in rows]
        le = LabelEncoder().fit(categories)

        X, y = [], []
        for cat, rating, reviews, dow, hour, label in rows:
            try:
                cat_enc = le.transform([cat])[0]
            except Exception:
                cat_enc = 0
            X.append([cat_enc, float(rating or 0), float(reviews or 0),
                       int(dow or 0), int(hour or 9)])
            y.append(int(label))

        import numpy as np
        X, y = np.array(X), np.array(y)

        if n >= 500:
            model = GradientBoostingClassifier(n_estimators=100, max_depth=4, random_state=42)
            phase = 3
        else:
            model = LogisticRegression(max_iter=1000, class_weight='balanced')
            phase = 2

        model.fit(X, y)

        with open(MODEL_FILE, 'wb') as f:
            pickle.dump({'model': model, 'le': le, 'phase': phase}, f)

        # Score all leads
        scores = {}
        all_cats = set(le.classes_)
        for lead in leads:
            cat = lead['category'] or ''
            if cat not in all_cats:
                continue
            try:
                feat = np.array([[
                    le.transform([cat])[0],
                    float(lead['rating'] or 0),
                    float(lead['review_count'] or 0),
                    3, 10  # Assume mid-week morning for future predictions
                ]])
                scores[lead['id']] = round(float(model.predict_proba(feat)[0][1]), 4)
            except Exception:
                pass

        log.info(f"Phase {phase} ML model trained on {n} calls, scored {len(scores)} leads")
        return scores

    except ImportError:
        log.warning("scikit-learn not available — using heuristic scoring")
        return None
    except Exception as e:
        log.error(f"ML scoring error: {e}")
        return None


def partial_update(lead_id, outcome):
    """
    Online learning: update model with a single new outcome immediately after a call.
    Uses SGDClassifier (supports partial_fit) so we never retrain from scratch.
    Falls back gracefully if sklearn not available or not enough data yet.
    """
    try:
        import numpy as np
        from sklearn.linear_model import SGDClassifier
        from sklearn.preprocessing import LabelEncoder
        import pickle

        db = sqlite3.connect(DB_FILE)
        db.row_factory = sqlite3.Row

        lead = db.execute("SELECT * FROM leads WHERE id=?", (lead_id,)).fetchone()
        if not lead:
            db.close()
            return

        label = 1 if outcome in ('interested', 'converted', 'maybe') else 0

        # Load or bootstrap the online model
        online_model_file = MODEL_FILE.replace('.pkl', '_online.pkl')
        if os.path.exists(online_model_file):
            with open(online_model_file, 'rb') as f:
                state = pickle.load(f)
            clf = state['clf']
            le  = state['le']
            n   = state['n']
        else:
            # Bootstrap from all existing outcomes
            rows = db.execute("""
                SELECT l.category, l.rating, l.review_count,
                       CAST(strftime('%w', c.started_at) AS INTEGER) AS dow,
                       CAST(strftime('%H', c.started_at) AS INTEGER) AS hour,
                       CASE WHEN l.status IN ('interested','converted','maybe') THEN 1 ELSE 0 END AS lbl
                FROM calls c JOIN leads l ON c.lead_id = l.id
                WHERE c.outcome = 'completed'
            """).fetchall()

            if len(rows) < 20:
                db.close()
                return  # Not enough data to bootstrap yet

            categories = [r[0] for r in rows]
            le = LabelEncoder().fit(categories + [lead['category']])
            clf = SGDClassifier(loss='log_loss', max_iter=1000, random_state=42)

            X = np.array([[
                le.transform([r[0]])[0] if r[0] in le.classes_ else 0,
                float(r[1] or 0), float(r[2] or 0), int(r[3] or 0), int(r[4] or 9)
            ] for r in rows])
            y = np.array([r[5] for r in rows])
            clf.fit(X, y)
            n = len(rows)

        # Apply partial_fit with this new data point
        cat = lead['category']
        if cat not in le.classes_:
            # Extend the encoder with new category
            import numpy as np
            le.classes_ = np.append(le.classes_, cat)

        x_new = np.array([[
            le.transform([cat])[0],
            float(lead['rating'] or 0),
            float(lead['review_count'] or 0),
            datetime.utcnow().weekday(),
            datetime.utcnow().hour
        ]])
        clf.partial_fit(x_new, [label], classes=[0, 1])
        n += 1

        with open(online_model_file, 'wb') as f:
            pickle.dump({'clf': clf, 'le': le, 'n': n}, f)

        # Re-score leads in the same category with updated model
        similar = db.execute(
            "SELECT id, category, rating, review_count FROM leads WHERE category=? AND status IN ('new','no_answer')",
            (cat,)
        ).fetchall()

        for sim in similar:
            try:
                feat = np.array([[
                    le.transform([sim[1]])[0],
                    float(sim[2] or 0), float(sim[3] or 0), 3, 10
                ]])
                new_score = float(clf.predict_proba(feat)[0][1])
                db.execute("UPDATE leads SET score=? WHERE id=?", (round(new_score, 4), sim[0]))
            except Exception:
                pass

        db.commit()
        db.close()
        log.info(f"Online update: lead_id={lead_id} outcome={outcome} label={label} model_n={n}")

    except ImportError:
        pass  # sklearn not available, skip silently
    except Exception as e:
        log.warning(f"partial_update failed: {e}")


def main():
    db = sqlite3.connect(DB_FILE)
    db.row_factory = sqlite3.Row

    leads = db.execute(
        "SELECT id, category, rating, review_count FROM leads WHERE status IN ('new','no_answer','calling')"
    ).fetchall()

    if not leads:
        log.info("No leads to score")
        db.close()
        return

    log.info(f"Scoring {len(leads)} leads...")

    ml_scores = train_and_score(db, [dict(l) for l in leads])

    updated = 0
    for lead in leads:
        lead = dict(lead)
        score = (ml_scores or {}).get(lead['id'])
        if score is None:
            score = heuristic_score(lead['category'], lead['rating'], lead['review_count'])
        db.execute("UPDATE leads SET score=? WHERE id=?", (score, lead['id']))
        updated += 1

    db.commit()
    db.close()
    log.info(f"Scored {updated} leads")


if __name__ == '__main__':
    main()
