import { NextRequest, NextResponse } from "next/server";
import {
  attachInboundRecording,
  isStorageConfigured,
} from "@/lib/storage/client";
import { verifyTwilioWebhookKey } from "@/lib/twilio-public";

/** Twilio recording status callback after inbound voicemail. */
export async function POST(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!verifyTwilioWebhookKey(request, key)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const form = await request.formData();
  const status = (form.get("RecordingStatus") as string | null)?.trim();
  if (status && status !== "completed") {
    return new NextResponse("OK", { status: 200 });
  }

  const callSid = (form.get("CallSid") as string | null)?.trim() ?? null;
  const recordingSid = (form.get("RecordingSid") as string | null)?.trim();
  const recordingUrl = (form.get("RecordingUrl") as string | null)?.trim();
  const durationRaw = form.get("RecordingDuration");
  const durationSeconds =
    durationRaw != null ? parseInt(String(durationRaw), 10) : null;

  if (!recordingSid || !recordingUrl) {
    return new NextResponse("Missing recording", { status: 400 });
  }

  if (isStorageConfigured()) {
    try {
      await attachInboundRecording({
        callSid,
        recordingSid,
        recordingUrl,
        durationSeconds: Number.isFinite(durationSeconds)
          ? durationSeconds
          : null,
      });
    } catch {
      /* Twilio expects 200 to stop retries */
    }
  }

  return new NextResponse("OK", { status: 200 });
}
