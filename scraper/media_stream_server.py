#!/usr/bin/env python3
"""
Twilio Media Streams → Deepgram → Mac Mini SQLite coach_messages (prospect vs rep legs).

Run on Mac Mini alongside the scraper (not on Vercel):
  python media_stream_server.py

Requires: MEDIA_STREAM_PORT, DEEPGRAM_API_KEY (uses ~/.web-dialer/dialer.db)
Expose WSS via ngrok/Tailscale; set MEDIA_STREAM_WSS_URL on Vercel TwiML path.
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
from collections import defaultdict
from pathlib import Path

import requests
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent / ".env")

import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "storage"))
import local_db as db  # noqa: E402

LOG = logging.getLogger("media_stream")
PORT = int(os.getenv("MEDIA_STREAM_PORT", "8765"))
DEEPGRAM_KEY = os.getenv("DEEPGRAM_API_KEY", "").strip()
FLUSH_SEC = 2.5

# inbound = prospect PSTN, outbound = browser rep audio
TRACK_TO_ROLE = {
    "inbound": "transcript_prospect",
    "outbound": "transcript_rep",
    "inbound_track": "transcript_prospect",
    "outbound_track": "transcript_rep",
}


def transcribe_mulaw(audio: bytes) -> str:
    if not DEEPGRAM_KEY or len(audio) < 800:
        return ""
    r = requests.post(
        "https://api.deepgram.com/v1/listen",
        params={
            "model": "nova-2-phonecall",
            "encoding": "mulaw",
            "sample_rate": 8000,
            "punctuate": "true",
        },
        headers={
            "Authorization": f"Token {DEEPGRAM_KEY}",
            "Content-Type": "audio/mulaw",
        },
        data=audio,
        timeout=15,
    )
    r.raise_for_status()
    data = r.json()
    return (
        data.get("results", {})
        .get("channels", [{}])[0]
        .get("alternatives", [{}])[0]
        .get("transcript", "")
        .strip()
    )


def insert_line(session_id: str, role: str, text: str) -> None:
    if not text:
        return
    db.insert_coach_message(session_id, role, text[:500])


async def flush_track(
    session_id: str,
    track: str,
    buffers: dict[str, bytearray],
) -> None:
    buf = buffers.pop(track, None)
    if not buf or len(buf) < 800:
        return
    role = TRACK_TO_ROLE.get(track)
    if not role:
        return
    try:
        text = await asyncio.to_thread(transcribe_mulaw, bytes(buf))
        if text:
            await asyncio.to_thread(insert_line, session_id, role, text)
            LOG.info("%s %s: %s", session_id[:8], role, text[:80])
    except Exception as exc:
        LOG.warning("Transcribe failed: %s", exc)


async def handler(websocket):
    db.init_db()
    session_id: str | None = None
    buffers: dict[str, bytearray] = defaultdict(bytearray)
    last_flush: dict[str, float] = defaultdict(float)

    try:
        async for message in websocket:
            data = json.loads(message)
            event = data.get("event")

            if event == "start":
                start = data.get("start", {})
                custom = start.get("customParameters") or {}
                if isinstance(custom, list):
                    custom = {
                        p.get("name"): p.get("value")
                        for p in custom
                        if isinstance(p, dict)
                    }
                session_id = (
                    custom.get("sessionId")
                    or custom.get("sessionid")
                    or start.get("callSid")
                )
                LOG.info("Stream start session=%s", session_id)
                continue

            if event == "media" and session_id:
                media = data.get("media", {})
                track = media.get("track", "inbound")
                payload = media.get("payload")
                if not payload:
                    continue
                buffers[track] += base64.b64decode(payload)
                now = asyncio.get_event_loop().time()
                if now - last_flush[track] >= FLUSH_SEC:
                    last_flush[track] = now
                    await flush_track(session_id, track, buffers)

            if event == "stop" and session_id:
                for track in list(buffers.keys()):
                    await flush_track(session_id, track, buffers)
                LOG.info("Stream stop session=%s", session_id)
    except Exception as exc:
        LOG.exception("WS error: %s", exc)


async def main():
    logging.basicConfig(level=logging.INFO)
    try:
        import websockets
    except ImportError:
        LOG.error("pip install websockets")
        raise

    LOG.info("Media stream server on ws://0.0.0.0:%d", PORT)
    async with websockets.serve(handler, "0.0.0.0", PORT):
        await asyncio.Future()


if __name__ == "__main__":
    asyncio.run(main())
