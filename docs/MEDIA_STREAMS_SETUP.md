# Prospect vs You — Media Streams setup (item 3)

This is **not** something Vercel can run alone. The code is already in the repo; you wire **three pieces**:

| Piece | Where | What |
|-------|--------|------|
| TwiML starts stream | **Vercel** (env only) | `MEDIA_STREAM_WSS_URL` |
| WebSocket + STT | **Mac Mini** (process) | `python media_stream_server.py` |
| Public WSS URL | **Tunnel** (ngrok / Tailscale) | Twilio must reach your Mini |

Until `MEDIA_STREAM_WSS_URL` is set, calls still work — coach uses **Safari mic** (mixed audio). After setup, the dialer shows **Prospect** / **You** lines.

---

## Prerequisites

- Migrations **010** applied (speaker roles on `coach_messages`)
- `DEEPGRAM_API_KEY` on Mac Mini `scraper/.env` (free credits for new accounts)
- Same `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` as the scraper

---

## Step 1 — Run the media server on the Mac Mini

```bash
cd /path/to/website-selling/scraper
source .venv/bin/activate
pip install -r requirements.txt   # includes websockets
python media_stream_server.py
```

You should see: `Media stream server on ws://0.0.0.0:8765`

Optional: use `mac-mini/run-media-stream.sh` (git pull + venv + server).

---

## Step 2 — Expose WSS to the internet

Twilio requires **`wss://`** (secure WebSocket), not plain `ws://`.

### Option A — ngrok (quickest test)

```bash
ngrok http 8765
```

Copy the **HTTPS** URL, e.g. `https://abc123.ngrok-free.app`, and set on Vercel:

```bash
MEDIA_STREAM_WSS_URL=wss://abc123.ngrok-free.app
```

ngrok forwards HTTP to 8765; Twilio’s Media Stream connects via WSS to that host. If ngrok only gives you HTTPS, use the same host with `wss://` (ngrok supports WebSocket upgrade on the tunnel).

### Option B — Tailscale Funnel / static host

If the Mini has a stable hostname, point `wss://your-host:8765` (or reverse proxy with TLS) at port 8765.

---

## Step 3 — Vercel environment variable

In Vercel → Project → Settings → Environment Variables (Production):

| Name | Example |
|------|---------|
| `MEDIA_STREAM_WSS_URL` | `wss://abc123.ngrok-free.app` |

Redeploy after adding. **No code change** — [voice/route.ts](apps/dialer/src/app/api/twilio/voice/route.ts) already injects `<Stream>` when this is set and the browser passes `sessionId`.

---

## Step 4 — Verify on a real call

1. Log in as `david` or `x` on iPhone, start a queue call.
2. Coach panel header should say **On the call · prospect / you**.
3. Mac Mini log: `Stream start session=<uuid>`
4. After a few seconds, **Prospect:** and **You:** lines appear in the dialer.

If stream never starts: check Twilio Debugger, ngrok tunnel, and that `sessionId` is passed (already in [usePhoneCall.ts](apps/dialer/src/hooks/usePhoneCall.ts)).

---

## 24/7 on the Mini (launchd)

See second plist example in [docs/MACHINES.md](MACHINES.md) for `com.webdialer.media-stream` running `mac-mini/run-media-stream.sh`.

Keep **ngrok** or your tunnel running too, or use a host with a real TLS cert.

---

## Cost

- **Deepgram**: only while calls are active (chunked mulaw transcription)
- **Vercel**: no extra charge for the env var; TwiML is one XML response per call
- **Twilio**: Media Streams included in call pricing (no separate OpenAI Realtime bill)
