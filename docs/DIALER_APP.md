# Dialer app — UX and behavior

Mobile-first PWA at `apps/dialer` (Vercel). Reps sign in with **`david`** or **`roslyn`** and one shared **`DIALER_PASSWORD`**.

## Tabs

| Tab | What you do here |
|-----|------------------|
| **Keypad** | **AI coach** has two levels: (1) **Default for next keypad call** on the Keypad tab before you dial; (2) **This call only** in the toolbar while on a keypad call — turning off mid-call does not change your default for the next dial. |
| **During any live call** | **iPhone-style call screen**: number on top, **Say now** coach in the middle, **Mute** + red **End** at the bottom. Tabs stay in the header but the call UI is full-screen until hang up. Lead calls always use coach; keypad calls respect the toggle. |
| **Leads** | See **N leads ready**, current lead card, **Call this lead**, outcome buttons, post-call wrap-up. One line under the queue shows **daily tip** and **last scraper refill** (no extra dropdown). |
| **History** | **Missed calls** (voicemail + **Call back**), **Past leads** (tap a row → opens that lead on the Leads tab). Badge when unread missed calls exist. |

## Queue label

Shows **“5 leads ready”** (not a “5/100” cap display). Secondary text only when the queue is full (100 `New` per rep).

## Missed calls and inbound

- Your Twilio number should POST to **`/api/twilio/incoming`** (voicemail when nobody answers in the browser).
- Recordings attach via **`/api/twilio/recording`** (uses `STORAGE_API_SECRET` or `TWILIO_WEBHOOK_SECRET`).
- The **History** tab shows **your outbound calls** (keypad + leads), **missed inbound**, and **past lead outcomes**.
- Outbound list: **`/api/calls/outbound`** → Mac Mini **`/call-sessions/recent`** (requires storage API update + `dialed_phone` column).
- Missed inbound: **`/api/calls/missed`** → **`/inbound/missed`**.
- If the Mini API is old (404), the app shows **“No missed calls”** and a gray setup hint — not a red error.

Restart **`storage/api_server.py`** on the Mac Mini after pulling repo changes that add inbound routes.

## AI coach (two providers)

| Phase | Provider | Where the key lives |
|-------|----------|---------------------|
| **On a live call** (Say now lines) | OpenRouter → DeepSeek (`OPENROUTER_LIVE_MODEL`) | **Vercel** env only |
| **After the call** (summary, score, playbook) | Gemini first → OpenRouter fallback on 429 | **Vercel** env only |
| **Nightly tip** | Same (Gemini first, OpenRouter fallback) | Vercel cron |

Live coach uses a **compact SOP prompt** (same compliance and stage rules, fewer tokens). It re-fires when **new prospect speech** arrives (Safari speech, or **Media Streams** prospect leg when `MEDIA_STREAM_WSS_URL` is set). The model is told to **respond to what they said**, not repeat the opening.

**Elite coach context (no extra cost — all deterministic):**

- **Call memory** (`call-memory.ts`) — the client sends up to 4 000 chars of transcript; the server rebuilds per-turn memory from it: objections already raised, the coach's last 3 lines (model is told never to repeat them), and the opening snippet on long calls.
- **Objection library** (`objection-library.ts`) — 17 curated objection→counter pairs (price, "have a guy", send-email, scam, think-about-it, do-not-call, …). When the prospect's speech matches one, the proven counter is injected into the prompt; the learned playbook layers niche wins on top.
- **Rep-echo filter** (`rep-echo.ts`) — with mixed Safari speech, sentences that heavily overlap a recent coach line are treated as the **rep** talking and excluded from objection matching, so the coach no longer mistakes your own pitch for a prospect objection. Media Streams legs are already speaker-labeled and skip this.
- **"If they say…" hints** — after each Say-now line, the panel shows the 1–2 most likely next objections for the current stage with library counters, computed without any LLM call, so the answer is on screen *before* the objection lands.

**STT note:** `DEEPGRAM_API_KEY` on Vercel alone does **not** switch the phone to browser Deepgram (that fought Twilio for the mic). Use **Media Streams** on the Mac Mini for labeled prospect/rep lines, or Safari speech (mixed audio).

**Not on Mac Mini:** Keep `OPENROUTER_API_KEY` (live coach + fallback) and `GEMINI_API_KEY` (recaps) on Vercel.

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
