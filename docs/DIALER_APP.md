# Dialer app — UX and behavior

Mobile-first PWA at `apps/dialer` (Vercel). Reps sign in with **`david`** or **`roslyn`** and one shared **`DIALER_PASSWORD`**.

## Tabs

| Tab | What you do here |
|-----|------------------|
| **Keypad** | Type a number, **Call** / **End**. **AI coach** toggle (saved on device): for **keypad-started** calls, off = no OpenRouter; on = live coach. |
| **During any live call** | Toolbar + **Say now** coach stay visible on **Keypad, Leads, and History** until you hang up. Lead calls always use coach; keypad calls respect the toggle. |
| **Leads** | See **N leads ready**, current lead card, **Call this lead**, outcome buttons, post-call wrap-up. One line under the queue shows **daily tip** and **last scraper refill** (no extra dropdown). |
| **History** | **Missed calls** (voicemail + **Call back**), **Past leads** (tap a row → opens that lead on the Leads tab). Badge when unread missed calls exist. |

## Queue label

Shows **“5 leads ready”** (not a “5/100” cap display). Secondary text only when the queue is full (100 `New` per rep).

## Missed calls and inbound

- Your Twilio number should POST to **`/api/twilio/incoming`** (voicemail when nobody answers in the browser).
- Recordings attach via **`/api/twilio/recording`** (uses `STORAGE_API_SECRET` or `TWILIO_WEBHOOK_SECRET`).
- The **History** tab reads **`/api/calls/missed`** → Mac Mini **`/inbound/missed`**.
- If the Mini API is old (404), the app shows **“No missed calls”** and a gray setup hint — not a red error.

Restart **`storage/api_server.py`** on the Mac Mini after pulling repo changes that add inbound routes.

## AI coach (two providers)

| Phase | Provider | Where the key lives |
|-------|----------|---------------------|
| **On a live call** (Say now lines) | OpenRouter → DeepSeek (`OPENROUTER_LIVE_MODEL`) | **Vercel** env only |
| **After the call** (summary, score, playbook) | Gemini (`GEMINI_MODEL`, default `gemini-2.5-flash-lite`) | **Vercel** env only |
| **Nightly tip** | Same Gemini batch key | Vercel cron |

Live coach uses a **compact SOP prompt** (same compliance and stage rules, fewer tokens). Coaching quality should match before; you mainly avoid Gemini rate limits and repeated huge prompts.

**Not on Mac Mini:** OpenRouter and Gemini keys are only read by Next.js API routes on Vercel.

## Twilio / phone quirks

| Topic | Behavior |
|-------|----------|
| **Trial account** | Outbound only to numbers verified in Twilio Console until you upgrade. |
| **Token errors (20101)** | App refreshes voice token and re-registers the device; avoid refreshing the whole page. |
| **Speaker on iPhone** | Mute uses Twilio; speaker often still routes via the system call bar (iOS WebRTC limit). |
| **App closed** | Inbound goes to voicemail; use **History** when back in the app — the phone does not ring the PWA. |

## Test mode

`NEXT_PUBLIC_DIALER_TEST_MODE=true` — mock lead, no real Twilio or storage calls. History and missed lists stay empty.

## PWA

Add to Home Screen on iPhone (Safari). Static icons: `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`. Re-add after deploy if the icon looked like a letter “W”.

## Related docs

- [VERCEL_SETUP.md](VERCEL_SETUP.md) — deploy and env
- [PRODUCTION.md](PRODUCTION.md) — cron, health checks
- [LOCAL_STORAGE.md](LOCAL_STORAGE.md) — Mac Mini API + tunnel
- [MEDIA_STREAMS_SETUP.md](MEDIA_STREAMS_SETUP.md) — optional labeled transcript legs
