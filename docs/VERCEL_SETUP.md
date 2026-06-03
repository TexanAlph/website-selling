# Vercel setup checklist (website-selling)

Use this after connecting the GitHub repo in Vercel.

## 1. Root directory (required — fixes 404 / “site broke”)

The Next.js app lives in **`apps/dialer`**, not the repo root.

Vercel → **website-selling** → **Settings** → **General** → **Root Directory** → set to:

```
apps/dialer
```

Save → **Redeploy** production.

## 2. Turn off deployment protection (for iPhone + employee)

Vercel → **Settings** → **Deployment Protection** → for **Production**, allow public access.

## 3. Environment variables

In **Settings** → **Environment Variables** (Production):

| Variable | Required for |
|----------|----------------|
| `STORAGE_API_URL` | Mac Mini API (Cloudflare Tunnel HTTPS URL) |
| `STORAGE_API_SECRET` | Auth to storage API (same as Mac Mini) |
| `TWILIO_*` | Calling |
| `OPENROUTER_API_KEY` | Live coach (during calls) |
| `OPENROUTER_LIVE_MODEL` | e.g. `deepseek/deepseek-chat-v3-0324` |
| `GEMINI_API_KEY` | Post-call + nightly analysis |
| `GEMINI_MODEL` | e.g. `gemini-2.5-flash-lite` |
| `DIALER_PASSWORD` / `DIALER_AUTH_SECRET` | App login |

See **[docs/LOCAL_STORAGE.md](LOCAL_STORAGE.md)** for Mac Mini + tunnel setup.

**Remove** any `NEXT_PUBLIC_SUPABASE_*` variables — no longer used.

## 4. App login

Users: `david` and `roslyn`. Password in `DIALER_PASSWORD`.

## 5. Twilio Voice URL

```
https://website-selling-101.vercel.app/api/twilio/voice
```

## 6. Twilio inbound (voicemail → History tab)

On your **Twilio phone number**, set Voice URL (POST):

```
https://YOUR_DOMAIN/api/twilio/incoming
```

Recording callback is handled by `/api/twilio/recording` (see `TWILIO_WEBHOOK_SECRET` or defaults to `STORAGE_API_SECRET` in `.env.example`).

## 7. Smoke test

1. Mac Mini: `curl http://127.0.0.1:8787/health` and restart `api_server.py` after pulls that touch `storage/`.
2. iPhone → login (`david` or `roslyn`) → real leads (not test mode).
3. **Leads** tab — one-line daily tip + scraper status under queue count.
4. **History** tab — “No missed calls” / “No logged outcomes yet” when empty (not red errors).

See **[DIALER_APP.md](DIALER_APP.md)** for tabs and UX.

## Production URL

- **Production:** `https://website-selling-101.vercel.app` (use your Vercel **Domains** tab if this changes)
