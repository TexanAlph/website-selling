# Free-first stack choices

Defaults minimize recurring cost. You still pay for **Twilio minutes** and **Google Places** on the Mac Mini.

## Recommended stack (what we ship)

| Layer | Default | Paid upgrade | Why |
|-------|---------|--------------|-----|
| **Database** | Mac Mini SQLite + tunnel | — | No Supabase required |
| **Hosting** | Vercel Hobby | Pro if team grows | Next.js dialer |
| **STT** | **Safari Web Speech** | Deepgram (optional) | $0 on iPhone |
| **Live LLM** | **OpenRouter + DeepSeek V3** (default) | — | During calls; pay-per-token on OpenRouter |
| **Batch LLM** | **Gemini first** (if key set) → OpenRouter fallback | `BATCH_LLM_PROVIDER=openrouter` to skip Gemini | Post-call recap + nightly |
| **Voice** | Twilio | — | ~$0.013/min US outbound |
| **Leads** | Google Places (Mac Mini) | — | Scraper with cache |

## Where API keys live

| Key | Put it on | Do **not** put it on |
|-----|-----------|----------------------|
| `OPENROUTER_API_KEY` | **Vercel** (required for coach) | Mac Mini |
| `GEMINI_API_KEY` | **Vercel** (optional) | Mac Mini |
| `TWILIO_*` | **Vercel** | Mac Mini |
| `STORAGE_API_URL` + `STORAGE_API_SECRET` | **Vercel and Mac Mini** (same secret both sides) | — |
| `GOOGLE_MAPS_API_KEY` | **Mac Mini** (scraper) | Vercel (dialer app does not use it) |

**Plain English:** Live coach uses OpenRouter. Recaps try Gemini first when `GEMINI_API_KEY` is set; if credits are out (429), the app retries on OpenRouter. Keep both keys on Vercel. Mac Mini only stores data and runs the scraper.

Google Cloud billing for Maps is separate from Gemini AI Studio — same Gmail does **not** mean one bill or one free tier.

## Environment toggles

```bash
# Vercel — keep BOTH keys for best behavior
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_LIVE_MODEL=deepseek/deepseek-chat-v3-0324
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite

# Speech ($0 default)
COACH_STT_PROVIDER=webspeech

# Optional: force OpenRouter-only for recaps (skip Gemini)
# BATCH_LLM_PROVIDER=openrouter
```

## Cost estimate (2 reps)

| Item | ~$/month |
|------|----------|
| Vercel + storage tunnel | $0 |
| OpenRouter live coach (medium calling) | $8–35 |
| Twilio | $15–40 |
| Google Places scraper | $0–10 |
| Deepgram (optional) | $0 until credits used |

**Live coach** uses OpenRouter. **Recaps/nightly** try Gemini first, then OpenRouter on quota errors.

**Queue cleanup:** stale `Calling` leads reset inside the same **daily** `/api/cron/analyze` job (Hobby-safe). No second Vercel cron required.

## Setup order

1. Vercel: `STORAGE_API_*`, `OPENROUTER_API_KEY`, login + Twilio when ready.
2. Mac Mini: storage API, tunnel, scraper — no OpenRouter/Gemini on the Mini.
3. Deepgram only if Safari STT is too noisy.
