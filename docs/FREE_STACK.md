# Free-first stack choices

This project defaults to **$0 recurring cost** for AI coach features. You only pay for what you cannot avoid: **phone minutes** (Twilio) and **Maps lookups** (Google Places).

## Recommended stack (what we ship)

| Layer | Default (free) | Paid upgrade | Why |
|-------|----------------|--------------|-----|
| **Database** | Supabase Free | Pro $25/mo | 500MB DB, Realtime, Auth — enough for 2 reps |
| **Hosting** | Vercel Hobby | Pro if team grows | Next.js dialer |
| **STT (speech-to-text)** | **Safari Web Speech API** | Deepgram (optional) | $0, no key; works on iPhone when mic allowed |
| **LLM coach** | **Gemini 2.0 Flash** (AI Studio) | — | Generous free RPM on [aistudio.google.com](https://aistudio.google.com) |
| **Voice calls** | Twilio pay-as-you-go | — | No free PSTN; ~$0.013/min US outbound |
| **Lead scrape** | Google Places (monthly credit) | — | Mac Mini only; cache reduces API calls |

## What we did *not* choose (and why)

| Option | Verdict |
|--------|---------|
| **Twilio Media Streams → Deepgram live WS** | Best audio quality, but needs a **persistent WebSocket server** (not ideal on Vercel serverless). We use **chunked MediaRecorder → Deepgram prerecorded** instead when you add a key. |
| **OpenAI Realtime / GPT-4o voice** | Excellent, not free |
| **Vapi / Bland AI** | Built for AI agents, not human dialers; removed from this repo |
| **AssemblyAI** | Good free tier; Deepgram Nova is slightly better for telephony-style audio |

## Environment toggles

```bash
# $0 — Safari transcribes in the browser (default)
COACH_STT_PROVIDER=webspeech

# Auto: use Deepgram if DEEPGRAM_API_KEY is set (~$200 free credit for new accounts)
COACH_STT_PROVIDER=auto

# Force Deepgram chunked mic STT (Vercel-compatible)
COACH_STT_PROVIDER=deepgram
DEEPGRAM_API_KEY=...

# Gemini — free tier at Google AI Studio
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-2.0-flash
```

## Cost estimate (2 reps, light usage)

- Supabase + Vercel + Gemini + Web Speech: **$0/mo**
- Twilio: **~$15–40/mo** depending on call volume (biggest line item)
- Google Places scraper: often **$0–10/mo** with 7-day search cache
- Deepgram (optional): **$0** until free credits used, then usage-based

## Setup order (minimize spend)

1. Supabase + Vercel + Gemini key only → coach works free.
2. Twilio number + TwiML when ready to dial.
3. Google Places key on Mac Mini for scraping.
4. Deepgram key only if Safari STT quality isn’t enough on noisy calls.
