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
| `GEMINI_API_KEY` | Coach |
| `DIALER_PASSWORD` / `DIALER_AUTH_SECRET` | App login |

See **[docs/LOCAL_STORAGE.md](LOCAL_STORAGE.md)** for Mac Mini + tunnel setup.

**Remove** any `NEXT_PUBLIC_SUPABASE_*` variables — no longer used.

## 4. App login

Users: `david` and `x`. Password in `DIALER_PASSWORD`.

## 5. Twilio Voice URL

```
https://website-selling-101.vercel.app/api/twilio/voice
```

## 6. Smoke test

1. Mac Mini: storage API healthy + tunnel reachable from browser: `https://YOUR_TUNNEL/health` (needs Bearer for other routes; `/health` is public).
2. iPhone opens production URL → login → real leads (not test mode).
3. Insights strip shows scraper status after first scrape run.

## Production URL

- **Production:** `https://website-selling-101.vercel.app` (use your Vercel **Domains** tab if this changes)
