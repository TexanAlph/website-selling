# Production checklist

## One-time setup

1. **Supabase** — Run migrations `001` through `010` in order (includes `assigned_rep`, scraper `skipped`, speaker transcript roles).
2. **Realtime** — Dashboard → Publications → `supabase_realtime` → enable `coach_messages` and **`leads`**.
3. **Vercel** — Root Directory `apps/dialer`; env vars from `apps/dialer/.env.example`.
4. **Mac Mini** — `headless_scraper.py` on launchd; optional `analysis/nightly_analyze.py`.
5. **Twilio** — Voice URL → `https://YOUR_DOMAIN/api/twilio/voice`.

## Required env (Vercel Production)

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Database |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Dialer client |
| `SUPABASE_SERVICE_ROLE_KEY` | **Mac Mini scraper only** (optional on Vercel) |
| `CRON_SECRET` | **Optional** — Vercel cron uses `x-vercel-cron` automatically |
| `GEMINI_API_KEY` | Coach + post-call analysis |
| `DIALER_PASSWORD` / `DIALER_AUTH_SECRET` | App login |
| Twilio vars | Calling |
| `NEXT_PUBLIC_DIALER_TEST_MODE` | **Omit** in production (auto-detects real Supabase keys) |

## Cron jobs (vercel.json)

| Path | Schedule | Action |
|------|----------|--------|
| `/api/cron/analyze` | Daily 07:00 UTC | Post-call backlog + daily insights |
| `/api/cron/reset-calling` | Every 30 min | `Calling` → `New` if stuck 30+ min |

## Verify

```bash
cd apps/dialer && npm run build && npm run test
curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR_DOMAIN/api/cron/reset-calling
```

## Still manual / future

- Per-user passwords (today: shared `DIALER_PASSWORD`)
- `MEDIA_STREAM_WSS_URL` + Mac Mini `media_stream_server.py` for prospect/you labels (Phase 2)
- Tighten anon RLS if the URL is ever public
- Sentry / uptime alerts
- Twilio call recording for richer transcripts
