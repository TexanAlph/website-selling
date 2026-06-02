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
- `scraper/media_stream_server.py`
- `pip install -r scraper/requirements.txt` for production scraping (OK for one-off debugging only if you know what you're doing)
- `launchctl load` scraper plists
- Storing production `scraper/.env` with **service role** key unless you accept the risk on a laptop you travel with

**Safe on Air:** cloning the repo, editing, committing, previewing the dialer locally.

---

## Mac Mini (production workhorse — separate Apple ID)

**Use for:**

- `scraper/.env` with `GOOGLE_MAPS_API_KEY` + `SUPABASE_SERVICE_ROLE_KEY` (scraper only — dialer does not use this)
- Optional `DEEPGRAM_API_KEY` for Media Streams leg transcription
- Python venv: `scraper/.venv` lives **on the Mini only**
- **24/7 launchd** running `mac-mini/run-scraper.sh` (hourly `git pull` + smart scrape)
- Optional **Media Streams** WS: `python scraper/media_stream_server.py` + expose WSS (ngrok/Tailscale)
- Cache dir default: `~/.web-dialer/` on the **Mini** (place IDs, search cache)
- `analysis/nightly_analyze.py` (optional if not using Vercel cron) — hits `/api/cron/analyze`

**After `git pull` on the Mini:**

```bash
cd /path/to/website-selling/scraper
source .venv/bin/activate   # create venv once on Mini, not Air
pip install -r requirements.txt
python headless_scraper.py    # manual test
```

**24/7 scraper (launchd example)** — save as `~/Library/LaunchAgents/com.webdialer.scraper.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.webdialer.scraper</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/bash</string>
    <string>/path/to/website-selling/mac-mini/run-scraper.sh</string>
  </array>
  <key>EnvironmentVariables</key>
  <dict>
    <key>WEB_DIALER_REPO</key><string>/path/to/website-selling</string>
  </dict>
  <key>StartInterval</key><integer>3600</integer>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><false/>
  <key>StandardOutPath</key><string>/tmp/webdialer-scraper.log</string>
  <key>StandardErrorPath</key><string>/tmp/webdialer-scraper.err</string>
</dict>
</plist>
```

Load: `launchctl load ~/Library/LaunchAgents/com.webdialer.scraper.plist`

When both reps have **100** `New` leads each, the scraper logs `skipped` and uses **$0** Google Places that hour.

**Media Streams (prospect vs you on screen):** full steps in [docs/MEDIA_STREAMS_SETUP.md](MEDIA_STREAMS_SETUP.md)

1. Mini: `./mac-mini/run-media-stream.sh` (port 8765)
2. Tunnel (ngrok): `ngrok http 8765` → `MEDIA_STREAM_WSS_URL=wss://…` on **Vercel**
3. `DEEPGRAM_API_KEY` in Mini `scraper/.env`

---

## Cloud (no Mac required 24/7)

| Service | Role |
|---------|------|
| **Supabase** | Database, auth, realtime coach |
| **Vercel** | Hosts `apps/dialer` (coach API + streaming during calls) |
| **Twilio** | Voice PSTN from iPhone Safari; one `TWILIO_CALLER_ID`, identities `david` / `x` |
| **Google AI Studio** | Gemini key on Vercel for coach |

---

## Git workflow (both machines)

1. **Air:** edit → commit → push `main`
2. **Mini:** `git pull` (automatic via `run-scraper.sh`) → scraper runs
3. **Vercel:** auto-deploys from GitHub (dialer only; root `apps/dialer`)

Never commit `.env`, `scraper/.env`, or `apps/dialer/.env.local` — they stay on each machine / Vercel dashboard.

---

## For AI assistants (Cursor, Claude Code)

- Assume the **current machine may be the MacBook Air** unless the user says "on the Mac Mini."
- Before `pip install`, `launchctl`, or scheduling scrapers: **ask or state** that those steps are **Mac Mini only**.
- Dialer `npm install` / `npm run dev` is **Air-safe** for local preview.
