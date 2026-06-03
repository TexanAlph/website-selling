import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import {
  createInboundCall,
  isStorageConfigured,
} from "@/lib/storage/client";
import {
  twilioPublicBaseUrl,
  twilioWebhookSecret,
} from "@/lib/twilio-public";

/**
 * Inbound calls to TWILIO_CALLER_ID — set on the Twilio phone number
 * (Voice → A call comes in). Records voicemail; does not ring the web app.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const from = (form.get("From") as string | null)?.trim() ?? "unknown";
  const callSid = (form.get("CallSid") as string | null)?.trim() ?? null;

  if (isStorageConfigured()) {
    try {
      await createInboundCall(from, callSid);
    } catch {
      /* still offer voicemail */
    }
  }

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();
  response.say(
    { voice: "Polly.Joanna" },
    "Sorry we missed your call. Please leave a message after the tone.",
  );

  const base = twilioPublicBaseUrl(request);
  const secret = twilioWebhookSecret();
  const callback = secret
    ? `${base}/api/twilio/recording?key=${encodeURIComponent(secret)}`
    : `${base}/api/twilio/recording`;

  response.record({
    maxLength: 120,
    playBeep: true,
    recordingStatusCallback: callback,
    recordingStatusCallbackMethod: "POST",
    recordingStatusCallbackEvent: ["completed"],
  });

  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
