# Web Dialer — Cloud Outbound System

Headless Mac Mini scrapes Google Maps leads into **local SQLite** and serves them via a **storage API** (exposed with **Cloudflare Tunnel**). Reps run a **mobile-first Next.js dialer** on **Vercel** with **Twilio Voice SDK**, outcome buttons, missed-call history, and a **Gemini-powered AI coach**.

**Two Macs, one repo:** edit on MacBook Air (Cursor) → push GitHub → pull on Mac Mini for scraper/cron only. See **[docs/MACHINES.md](docs/MACHINES.md)** so headless jobs never get installed on the Air by mistake.

## Repository layout

```
website-selling/
├── scraper/
│   ├── headless_scraper.py    # Mac Mini — Google Places → SQLite (storage API DB)
│   └── requirements.txt
├── storage/
│   ├── api_server.py          # Mac Mini — FastAPI + SQLite
│   ├── local_db.py
│   └── schema.sql
├── mac-mini/                  # launchd examples, run scripts
├── analysis/
│   └── nightly_analyze.py     # Mac Mini — hits /api/cron/analyze
├── docs/
│   ├── LOCAL_STORAGE.md       # Mac Mini + tunnel (required)
│   ├── VERCEL_SETUP.md        # Deploy checklist
│   ├── PRODUCTION.md          # Ops checklist
│   └── DIALER_APP.md          # App tabs, inbound, UX notes
├── supabase/migrations/       # Reference SQL only (live DB is SQLite on Mini)
└── apps/dialer/               # Next.js — Vercel root directory
```

## Quick start

| Step | Doc |
|------|-----|
| Mac Mini DB + API + tunnel | [docs/LOCAL_STORAGE.md](docs/LOCAL_STORAGE.md) |
| Vercel deploy + env vars | [docs/VERCEL_SETUP.md](docs/VERCEL_SETUP.md) |
| Production verify | [docs/PRODUCTION.md](docs/PRODUCTION.md) |
| How the app works (tabs, inbound) | [docs/DIALER_APP.md](docs/DIALER_APP.md) |

1. Set `STORAGE_API_URL` + `STORAGE_API_SECRET` on **Vercel** (same secret on Mac Mini).
2. **Login:** `david` or `roslyn` + shared `DIALER_PASSWORD` (cookie session — not cloud auth).
3. Live database: `~/.web-dialer/dialer.db` on the Mac Mini (not Supabase).

## Mac Mini headless scraper

```bash
cd scraper
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # GOOGLE_MAPS_API_KEY, STORAGE_API_* (see LOCAL_STORAGE.md)
python headless_scraper.py
```

**Google Cloud:** Enable Places API, create API key, restrict to Places.

Schedule with launchd — see README section in [docs/MACHINES.md](docs/MACHINES.md) or `mac-mini/com.webdialer.scraper.plist.example`.

Dedup is by **phone** in SQLite. Scraper pauses Google API when each rep has **100** `New` leads ([docs/PLACES_API_COSTS.md](docs/PLACES_API_COSTS.md)).

## Twilio Voice SDK (browser → PSTN)

1. Twilio Console → **API Key** + **TwiML App**.
2. TwiML App **Voice Request URL (outbound):** `https://YOUR_DOMAIN/api/twilio/voice` (POST).
3. Your **Twilio phone number** → Voice URL (inbound / voicemail): `https://YOUR_DOMAIN/api/twilio/incoming` (POST).
4. Buy a voice number → set `TWILIO_CALLER_ID`.
5. Env vars: `apps/dialer/.env.example`.

**Trial accounts:** outbound only to [verified numbers](https://www.twilio.com/docs/messaging/guides/how-to-use-your-free-trial-account) until you upgrade.

On iPhone Safari, **Add to Home Screen** for full-screen PWA (icons in `apps/dialer/public/`).

## Vercel deploy

1. Push repo to GitHub.
2. Vercel → New Project → **Root Directory:** `apps/dialer` ([docs/VERCEL_SETUP.md](docs/VERCEL_SETUP.md)).
3. Disable **Deployment Protection** on production (iPhone must load the app).
4. Add env vars from `apps/dialer/.env.example` (Production).
5. After Mac Mini API changes, restart `api_server.py` on the Mini.

## Local dev

```bash
cd apps/dialer
npm install
cp .env.example .env.local
npm run dev
```

**Test mode (no Twilio, no storage):** `NEXT_PUBLIC_DIALER_TEST_MODE=true` in `.env.local` — mock lead and simulated calls.

## Dialer app (summary)

Three tabs — details in **[docs/DIALER_APP.md](docs/DIALER_APP.md)**:

| Tab | Purpose |
|-----|---------|
| **Keypad** | Manual dial, mute/speaker, live coach on call |
| **Leads** | Queue count, call next lead, outcomes, post-call wrap-up, one-line daily tip + scraper status |
| **History** | Missed calls (voicemail, call back), past leads (tap reopens on Leads) |

- **Coach** — Web Speech (default) or Deepgram → **DeepSeek (OpenRouter)** live lines; **Gemini** after the call.
- **Outcomes** — Wrong number / Not interested / Interested → storage API → next `New` lead.
- **Inbound** — When the app is closed, Twilio records voicemail; list appears on **History** after storage API is up to date.

## AI coach (split LLM)

All LLM API keys go on **Vercel** (Next.js API routes). The Mac Mini only needs storage + scraper keys.

| When | Provider | Env |
|------|----------|-----|
| **Live calls** (streaming coach lines) | OpenRouter → DeepSeek | `OPENROUTER_API_KEY`, `OPENROUTER_LIVE_MODEL` |
| **Post-call + nightly** (summary, score, daily tip) | Gemini AI Studio | `GEMINI_API_KEY`, `GEMINI_MODEL` (default `gemini-2.5-flash-lite`) |

Live coach uses a **shorter SOP prompt** (same rules, fewer tokens per nudge). Details: **[docs/DIALER_APP.md](docs/DIALER_APP.md)** and **[docs/FREE_STACK.md](docs/FREE_STACK.md)**.

## Call learning loop

| Step | What happens |
|------|----------------|
| Call start | `POST /api/calls/session` — `session_id`, `lead_id`, niche |
| During call | Transcripts + counters → storage API; **OpenRouter/DeepSeek** for live lines |
| Outcome / hang-up | `PATCH /api/calls/session/:id` — transcript, outcome, duration |
| Post-call | **Gemini** analysis → session + playbook (Vercel cron or `nightly_analyze.py`) |
| Nightly | `/api/cron/analyze` — backlog + `daily_insights` |

Requires `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, and `STORAGE_API_*` on Vercel.

## AI / cost notes

See **[docs/FREE_STACK.md](docs/FREE_STACK.md)**.

| Variable | Default | Notes |
|----------|---------|--------|
| `COACH_STT_PROVIDER` | `webspeech` | Free on Safari |
| `OPENROUTER_LIVE_MODEL` | `deepseek/deepseek-chat-v3-0324` | Live coach only |
| `GEMINI_MODEL` | `gemini-2.5-flash-lite` | Batch analysis (free tier friendly) |

## Security checklist

- Never commit `.env` or `STORAGE_API_SECRET`.
- `STORAGE_API_SECRET` only on Vercel server + Mac Mini API (Bearer auth).
- Scraper and storage API run on the Mac Mini only.
- `DIALER_PASSWORD` / `DIALER_AUTH_SECRET` for rep login cookies.

## Removed (old stack)

Vapi outbound automation, Google Sheets sync, Flask webhooks, and Supabase-as-primary DB for the dialer. Optional `supabase/migrations/` remain as reference/schema history.
