# Production checklist

## One-time setup

1. **Mac Mini** — SQLite storage API + Cloudflare Tunnel ([LOCAL_STORAGE.md](LOCAL_STORAGE.md))
2. **Mac Mini** — `headless_scraper.py` on launchd
3. **Vercel** — Root Directory `apps/dialer`; env vars from `apps/dialer/.env.example`
4. **Twilio** — Voice URL → `https://YOUR_DOMAIN/api/twilio/voice`

## Required env (Vercel Production)

| Variable | Purpose |
|----------|---------|
| `STORAGE_API_URL` | Mac Mini API (tunnel) |
| `STORAGE_API_SECRET` | API auth |
| `GEMINI_API_KEY` | Coach + post-call analysis |
| `DIALER_PASSWORD` / `DIALER_AUTH_SECRET` | App login |
| Twilio vars | Calling |

## Cron jobs (vercel.json)

| Path | Schedule | Action |
|------|----------|--------|
| `/api/cron/analyze` | Daily 07:00 UTC | Post-call backlog + daily insights |
| `/api/cron/reset-calling` | Every 30 min | Stale `Calling` → `New` |

## Verify

```bash
cd apps/dialer && npm run build && npm run test
```

On Mac Mini: `curl http://127.0.0.1:8787/health`
