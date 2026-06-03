# Mac Mini storage + Cloudflare Tunnel (no Supabase)

All dialer data lives in **SQLite on the Mac Mini** (`~/.web-dialer/dialer.db`).  
**Vercel** hosts the app; **Cloudflare Tunnel** gives Vercel a secure HTTPS URL to the Mac Mini storage API.

## Architecture

```text
iPhone → Vercel (Next.js dialer)
           ↓ HTTPS + Bearer STORAGE_API_SECRET
         Cloudflare Tunnel → Mac Mini :8787 (storage API)
           ↑ direct SQLite writes
         Scraper + media stream (same DB file)
```

## Why Cloudflare Tunnel?

| Option | Cost | Notes |
|--------|------|--------|
| **Cloudflare Tunnel** | Free | Recommended — stable `https://` URL, no open router ports |
| ngrok | Free tier limited | Fine for testing |
| Tailscale | Free personal | Vercel cannot reach Tailscale IPs without extra proxy |

## Mac Mini setup (one time)

### 1. Install dependencies

```bash
cd /path/to/website-selling/scraper
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
pip install -r ../storage/requirements.txt
cp .env.example .env   # GOOGLE_MAPS_API_KEY + STORAGE_API_SECRET
```

Generate a secret (use the **same** value on Vercel):

```bash
openssl rand -hex 32
```

### 2. Run storage API (always on)

```bash
./mac-mini/run-storage-api.sh
```

Or launchd — see `mac-mini/com.webdialer.storage.plist.example`.

Check: `curl http://127.0.0.1:8787/health` → `{"status":"ok",...}`

### 3. Cloudflare Tunnel

1. Install: [developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)
2. Login: `cloudflared tunnel login`
3. Create tunnel: `cloudflared tunnel create web-dialer`
4. Route DNS (example): `storage.yourdomain.com` → tunnel
5. Config `~/.cloudflared/config.yml`:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /Users/you/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: storage.yourdomain.com
    service: http://127.0.0.1:8787
  - service: http_status:404
```

6. Run: `cloudflared tunnel run web-dialer` (or `brew services start cloudflared`)

Your public API base URL: `https://storage.yourdomain.com`

### 4. Scraper (hourly)

```bash
launchctl load ~/Library/LaunchAgents/com.webdialer.scraper.plist
```

Uses the same SQLite file — no separate database.

## Vercel env vars

| Variable | Value |
|----------|--------|
| `STORAGE_API_URL` | `https://storage.yourdomain.com` (tunnel URL, no trailing slash) |
| `STORAGE_API_SECRET` | Same as Mac Mini |
| `DIALER_PASSWORD` / `DIALER_AUTH_SECRET` | App login |
| `GEMINI_API_KEY` | Coach |
| Twilio vars | Calling |

Remove any old `NEXT_PUBLIC_SUPABASE_*` vars — they are unused.

Redeploy after adding vars.

## MacBook Air (local dev)

Point at the tunnel (or test mode):

```bash
cd apps/dialer
cp .env.example .env.local
# STORAGE_API_URL=https://storage.yourdomain.com
# STORAGE_API_SECRET=...
npm run dev
```

Or omit storage vars and set `NEXT_PUBLIC_DIALER_TEST_MODE=true` for mock UI only.

## Backup

Copy `~/.web-dialer/dialer.db` periodically (Time Machine or cron). That file is your entire lead/call history.
