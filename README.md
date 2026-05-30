# Web Dialer — Cloud Outbound System

Headless Mac Mini scrapes Google Maps leads into **Supabase**. You and your employee run a **mobile-first Next.js dialer** on iPhone Safari with **Twilio Voice SDK**, outcome buttons, and a **Gemini-powered AI coach** over Supabase Realtime.

**Two Macs, one repo:** edit on MacBook Air (Cursor) → push GitHub → pull on Mac Mini for scraper/cron only. See **[docs/MACHINES.md](docs/MACHINES.md)** so headless jobs never get installed on the Air by mistake.

## Repository layout

```
website-selling/
├── scraper/
│   ├── headless_scraper.py    # Mac Mini — Google Places → Supabase upsert
│   ├── requirements.txt
│   └── .env.example
├── docs/
│   └── FREE_STACK.md          # Free vs paid provider guide
├── supabase/
│   ├── config.toml            # Local CLI (optional)
│   └── migrations/
│       ├── 001_create_leads.sql
│       └── 002_coach_realtime.sql
└── apps/dialer/               # Next.js — deploy root for Vercel
    ├── src/
    │   ├── app/               # Pages + API routes
    │   ├── components/        # Lead card, dialer, coach panel
    │   └── lib/               # Supabase, wake lock
    └── .env.example
```

## 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com).
2. Run SQL in order:
   - `supabase/migrations/001_create_leads.sql`
   - `supabase/migrations/002_coach_realtime.sql`
3. **Realtime:** Dashboard → Database → Publications → `supabase_realtime` → enable `coach_messages`.
4. **Auth:** Invite your account + employee (Email magic link). Redirect URL: `https://YOUR_VERCEL_DOMAIN/**` and `http://localhost:3000/**`.
5. Copy keys: Project URL, anon key, service role key (Mac Mini + coach API only).

### Leads table (reference)

| Column         | Type        | Notes                          |
|----------------|-------------|--------------------------------|
| id             | uuid        | PK                             |
| business_name  | text        |                                |
| phone          | text        | **UNIQUE** — dedup at DB       |
| website        | text        | null = no/broken site          |
| status         | text        | Default `New`                  |
| niche          | text        | e.g. `roofing contractor`      |
| created_at     | timestamptz |                                |

## 2. Mac Mini headless scraper

```bash
cd scraper
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill GOOGLE_MAPS_API_KEY, SUPABASE_*
python headless_scraper.py
```

**Google Cloud:** Enable Places API, create API key, restrict to Places.

**Schedule (launchd example)** — save as `~/Library/LaunchAgents/com.webdialer.scraper.plist`:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.webdialer.scraper</string>
  <key>ProgramArguments</key>
  <array>
    <string>/path/to/scraper/.venv/bin/python</string>
    <string>/path/to/website-selling/scraper/headless_scraper.py</string>
  </array>
  <key>StartCalendarInterval</key>
  <dict>
    <key>Hour</key><integer>6</integer>
    <key>Minute</key><integer>0</integer>
  </dict>
  <key>StandardOutPath</key><string>/tmp/webdialer-scraper.log</string>
  <key>StandardErrorPath</key><string>/tmp/webdialer-scraper.err</string>
</dict>
</plist>
```

Load: `launchctl load ~/Library/LaunchAgents/com.webdialer.scraper.plist`

Upsert uses `on_conflict=phone` so duplicate numbers never create a second row.

## 3. Twilio Voice SDK (browser → PSTN)

1. Twilio Console → create **API Key** + **TwiML App**.
2. TwiML App **Voice Request URL:** `https://YOUR_DOMAIN/api/twilio/voice` (POST).
3. Buy a voice number → set `TWILIO_CALLER_ID`.
4. Add env vars from `apps/dialer/.env.example`.

On iPhone Safari, add the site to Home Screen for full-screen dialer UX.

## 4. Vercel deploy

1. Push repo to GitHub.
2. Vercel → New Project → import repo.
3. Set **Root Directory** to `apps/dialer`.
4. Add all env vars from `.env.example` (Production + Preview).
5. Deploy.

## 5. Local dev

```bash
cd apps/dialer
npm install
cp .env.example .env.local
npm run dev
```

Open on iPhone: same Wi‑Fi → `http://<your-mac-ip>:3000` (or use ngrok for Twilio webhooks).

## Dialer UX (mobile Safari only)

- **Lead card** — business, niche, website (or “missing” angle).
- **Call Next Lead** — Twilio `Device.connect({ To: phone })` + Screen Wake Lock.
- **AI Coach** — free STT (Safari Web Speech by default) → `/api/coach` → Gemini → Supabase Realtime.
- **Outcomes** — Wrong Number / Not Interested / Interested → updates Supabase → loads next `status = 'New'`.

### Free-first AI stack

See **[docs/FREE_STACK.md](docs/FREE_STACK.md)** for cost breakdown and provider choices.

| Variable | Default | Cost |
|----------|---------|------|
| `COACH_STT_PROVIDER` | `webspeech` | $0 (Safari) |
| `COACH_STT_PROVIDER` | `auto` + `DEEPGRAM_API_KEY` | ~$200 free credits, then usage |
| `GEMINI_API_KEY` | `gemini-2.0-flash` | Google AI Studio free tier |

Optional Deepgram uses **mic chunks** (MediaRecorder → `/api/coach` multipart) — works on Vercel without a WebSocket server.

## Security checklist

- Never commit `.env` or service role keys.
- Scraper uses **service role** only on the Mac Mini.
- Dialer browser uses **anon** + Supabase Auth + RLS.
- `SUPABASE_SERVICE_ROLE_KEY` only on Vercel server (coach route).

## Removed (old stack)

All Vapi outbound automation, Google Sheets sync, SQLite `leads.db`, Flask webhooks, and ML scoring scripts were removed. The Mac Mini now only runs `headless_scraper.py`.
