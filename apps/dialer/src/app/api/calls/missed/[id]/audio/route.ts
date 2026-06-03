import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/dialer-session";
import {
  getInboundCall,
  markInboundListened,
  isStorageConfigured,
} from "@/lib/storage/client";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  if (!(await getSessionUser())) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const { id } = await context.params;
  if (!isStorageConfigured()) {
    return new NextResponse("Storage not configured", { status: 503 });
  }

  const row = await getInboundCall(id);
  if (!row?.recording_url) {
    return new NextResponse("No recording", { status: 404 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim();
  const apiKey = process.env.TWILIO_API_KEY?.trim();
  const apiSecret = process.env.TWILIO_API_SECRET?.trim();
  if (!accountSid || !apiKey || !apiSecret) {
    return new NextResponse("Twilio not configured", { status: 500 });
  }

  const mp3Url = row.recording_url.endsWith(".mp3")
    ? row.recording_url
    : `${row.recording_url}.mp3`;

  const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString("base64");
  const twilioRes = await fetch(mp3Url, {
    headers: { Authorization: `Basic ${auth}` },
  });

  if (!twilioRes.ok) {
    return new NextResponse("Recording fetch failed", { status: 502 });
  }

  if (request.nextUrl.searchParams.get("mark") !== "0") {
    try {
      await markInboundListened(id);
    } catch {
      /* ignore */
    }
  }

  const bytes = await twilioRes.arrayBuffer();
  return new NextResponse(bytes, {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "private, no-store",
    },
  });
}
