# Free-first stack choices

Defaults minimize recurring cost. You still pay for **Twilio minutes** and **Google Places** on the Mac Mini.

## Recommended stack (what we ship)

| Layer | Default | Paid upgrade | Why |
|-------|---------|--------------|-----|
| **Database** | Mac Mini SQLite + tunnel | — | No Supabase required |
| **Hosting** | Vercel Hobby | Pro if team grows | Next.js dialer |
| **STT** | **Safari Web Speech** | Deepgram (optional) | $0 on iPhone |
| **Live LLM** | **OpenRouter + DeepSeek V3** | — | High RPM during calls; ~$0.25–1/M input tokens |
| **Batch LLM** | **Gemini 2.5 Flash-Lite** (AI Studio) | Paid if over free quota | Post-call + nightly only (low RPM) |
| **Voice** | Twilio | — | ~$0.013/min US outbound |
| **Leads** | Google Places (Mac Mini) | — | Scraper with cache |

## Where API keys live

| Key | Machine | Used for |
|-----|---------|----------|
| `STORAGE_API_*` | **Vercel + Mac Mini** | Leads, sessions, coach messages |
| `OPENROUTER_API_KEY` | **Vercel only** | Live coach during calls |
| `GEMINI_API_KEY` | **Vercel only** | Post-call swarm + nightly `/api/cron/analyze` |
| `GOOGLE_MAPS_API_KEY` | **Mac Mini only** | Scraper |
| `TWILIO_*` | **Vercel** | Voice SDK + webhooks |

Google Cloud billing for Maps is separate from Gemini AI Studio — same Gmail does **not** mean one bill or one free tier.

## Environment toggles

```bash
# Live coach (Vercel)
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_LIVE_MODEL=deepseek/deepseek-chat-v3-0324

# Batch analysis (Vercel) — use a current Flash model, not deprecated 2.0
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.5-flash-lite

# Speech ($0 default)
COACH_STT_PROVIDER=webspeech

# Optional: force live coach back to Gemini (may 429 on long calls)
# LIVE_LLM_PROVIDER=gemini
```

## Cost estimate (2 reps)

| Item | ~$/month |
|------|----------|
| Vercel + storage tunnel + Gemini batch (free tier) | $0 |
| OpenRouter live coach (medium calling) | $8–35 |
| Twilio | $15–40 |
| Google Places scraper | $0–10 |
| Deepgram (optional) | $0 until credits used |

**Gemini free tier** fits batch analysis well. **Live coach** was moved off Gemini to avoid free-tier **requests/minute** limits during active calls.

## Setup order

1. Vercel: `STORAGE_API_*`, `OPENROUTER_API_KEY`, `GEMINI_API_KEY`, login + Twilio when ready.
2. Mac Mini: storage API, tunnel, scraper — no OpenRouter/Gemini on the Mini.
3. Deepgram only if Safari STT is too noisy.
