# Vercel setup checklist (website-selling)

Use this after connecting the GitHub repo in Vercel.

## 1. Root directory (required — fixes 404 / “site broke”)

The Next.js app lives in **`apps/dialer`**, not the repo root.

If production shows **NOT_FOUND** or builds finish in **~2 seconds** with `framework: null`, Vercel is deploying the repo root (no Next app).

Vercel → **website-selling** → **Settings** → **General** → **Root Directory** → set to:

```
apps/dialer
```

Save → **Redeploy** production. A correct Next.js build takes **~30–60 seconds**, not ~2 seconds.

The repo also has a root `vercel.json` / `package.json` `vercel-build` fallback, but **Root Directory = `apps/dialer` is still the reliable fix** for Git deploys.

## 2. Turn off deployment protection (for iPhone + employee)

If previews show **“Authentication Required”**, the dialer is blocked on Safari.

Vercel → **Settings** → **Deployment Protection** → for **Production**, allow public access (or “Only Vercel” off for production URL).

Your employee’s iPhone must open the app **without** logging into Vercel.

## 3. Environment variables

In **Settings** → **Environment Variables** (Production), add at minimum:

| Variable | Required for |
|----------|----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Leads + coach |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Leads + coach |
| `TWILIO_ACCOUNT_SID` | Calling |
| `TWILIO_API_KEY` | Calling |
| `TWILIO_API_SECRET` | Calling |
| `TWILIO_TWIML_APP_SID` | Calling |
| `TWILIO_CALLER_ID` | Outbound caller ID |
| `GEMINI_API_KEY` | Coach (add when ready) |

Redeploy after adding vars.

## 4. App login (not Supabase Auth)

Only two users: `david` and `x`. Password is set in Vercel env:

| Variable | Example |
|----------|---------|
| `DIALER_PASSWORD` | `Money!` |
| `DIALER_AUTH_SECRET` | long random string (session cookie signing) |

No Supabase Auth users or magic links required.

## 5. Twilio Voice URL

TwiML App → Voice Request URL (POST):

```
https://website-selling-nu.vercel.app/api/twilio/voice
```

## 6. Smoke test on iPhone

1. Open production URL in Safari (not a preview URL that requires Vercel login).
2. You should see **login** or **dialer** — not a blank page or Vercel auth wall.
3. Add to Home Screen for full-screen UX.
4. Without Supabase env: errors on load. Without Twilio: “Connecting…” forever on Call.

## Production URLs (your project)

- **Production:** `https://website-selling-nu.vercel.app` (not `website-selling-101` — that host is not attached to this project)
- Use this exact host in Supabase Auth redirect URLs and Twilio TwiML Voice URL.
