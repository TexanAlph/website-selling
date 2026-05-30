# Which machine runs what

This repo is shared via **GitHub** across two Macs (different Apple IDs).  
**Do not** install or schedule headless production jobs on the MacBook Air.

## MacBook Air (dev — Cursor / Claude Code)

**Use for:**

- Editing code and pushing to GitHub
- `apps/dialer` local dev: `npm install`, `npm run dev` (optional)
- Supabase SQL migrations (copy/paste in dashboard or CLI)
- Vercel deploy is from GitHub — **not** from a long-running process on this Mac

**Do not run on the Air:**

- `scraper/headless_scraper.py` on a schedule
- `pip install -r scraper/requirements.txt` for production scraping (OK for one-off debugging only if you know what you're doing)
- `launchctl load` scraper plists
- Storing production `scraper/.env` with **service role** key unless you accept the risk on a laptop you travel with

**Safe on Air:** cloning the repo, editing, committing, previewing the dialer locally.

---

## Mac Mini (production workhorse — separate Apple ID)

**Use for:**

- `scraper/.env` with `GOOGLE_MAPS_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` (scraper only — dialer does not use this)
- Python venv: `scraper/.venv` lives **on the Mini only**
- Cron / **launchd** to run `headless_scraper.py` (e.g. weekly Monday 4 AM)
- Cache dir default: `~/.web-dialer/` on the **Mini** (place IDs, search cache)
- `analysis/nightly_analyze.py` (optional if not using Vercel cron) — hits `/api/cron/analyze`

**After `git pull` on the Mini:**

```bash
cd /path/to/website-selling/scraper
source .venv/bin/activate   # create venv once on Mini, not Air
pip install -r requirements.txt
python headless_scraper.py    # manual test
```

---

## Cloud (no Mac required 24/7)

| Service | Role |
|---------|------|
| **Supabase** | Database, auth, realtime coach |
| **Vercel** | Hosts `apps/dialer` (short API calls only during calls) |
| **Twilio** | Voice PSTN from iPhone Safari |
| **Google AI Studio** | Gemini key on Vercel when you enable coach |

---

## Git workflow (both machines)

1. **Air:** edit → commit → push `main`
2. **Mini:** `git pull` → run scraper / update venv if `requirements.txt` changed
3. **Vercel:** auto-deploys from GitHub (dialer only; root `apps/dialer`)

Never commit `.env`, `scraper/.env`, or `apps/dialer/.env.local` — they stay on each machine / Vercel dashboard.

---

## For AI assistants (Cursor, Claude Code)

- Assume the **current machine may be the MacBook Air** unless the user says "on the Mac Mini."
- Before `pip install`, `launchctl`, or scheduling scrapers: **ask or state** that those steps are **Mac Mini only**.
- Dialer `npm install` / `npm run dev` is **Air-safe** for local preview.
