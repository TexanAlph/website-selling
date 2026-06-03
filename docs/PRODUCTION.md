# Production checklist

## One-time setup

1. **Mac Mini** — SQLite storage API + Cloudflare Tunnel ([LOCAL_STORAGE.md](LOCAL_STORAGE.md))
2. **Mac Mini** — `headless_scraper.py` on launchd
3. **Vercel** — Root Directory `apps/dialer`; env vars from `apps/dialer/.env.example`
4. **Twilio outbound** — TwiML App Voice URL → `https://YOUR_DOMAIN/api/twilio/voice`
5. **Twilio inbound** — Phone number Voice URL → `https://YOUR_DOMAIN/api/twilio/incoming`

## Required env (Vercel Production)

| Variable | Purpose |
|----------|---------|
| `STORAGE_API_URL` | Mac Mini API (tunnel) |
| `STORAGE_API_SECRET` | API auth |
| `OPENROUTER_API_KEY` | Live coach during calls |
| `OPENROUTER_LIVE_MODEL` | e.g. `deepseek/deepseek-chat-v3-0324` |
| `OPENROUTER_API_KEY` | Live coach + post-call + nightly (required) |
| `OPENROUTER_LIVE_MODEL` | e.g. `deepseek/deepseek-chat-v3-0324` |
| `GEMINI_API_KEY` | Optional — only if `BATCH_LLM_PROVIDER=gemini` |
| `DIALER_PASSWORD` / `DIALER_AUTH_SECRET` | App login (`david`, `roslyn`) |
| Twilio vars | Calling + webhooks |

## Cron jobs (vercel.json)

| Path | Schedule | Action |
|------|----------|--------|
| `/api/cron/analyze` | Daily 07:00 UTC | Stale `Calling` → `New` (30+ min), then post-call backlog + daily insights |

On **Vercel Hobby**, only **one daily** built-in cron is allowed. `/api/cron/reset-calling` still exists for optional Mac Mini or external schedulers if you need more than once per day.

## After each deploy

1. **Vercel** — production deployment green
2. **Mac Mini** — `git pull` and restart storage API if `storage/` or inbound routes changed:
   ```bash
   # however you run it, e.g.
   ./mac-mini/run-storage-api.sh
   ```
3. **iPhone** — hard refresh or re-open PWA; re-add to Home Screen if icons changed

## Verify

```bash
cd apps/dialer && npm run build && npm run test
```

On Mac Mini:

```bash
curl http://127.0.0.1:8787/health
curl -H "Authorization: Bearer $STORAGE_API_SECRET" \
  "http://127.0.0.1:8787/inbound/missed?limit=1"
```

On iPhone:

1. Login as `david` or `roslyn`
2. **Leads** — real queue count (not test mode)
3. **History** — empty states or missed list (not red “Not found”)
4. Optional inbound test — call your Twilio number → voicemail → appears under **History**

App behavior reference: [DIALER_APP.md](DIALER_APP.md)
