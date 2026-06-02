import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

/**
 * Twilio TwiML App Voice URL — dials the lead number from the browser client.
 * Optional Media Stream (Phase 2): set MEDIA_STREAM_WSS_URL on Vercel.
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const to = (form.get("To") as string | null)?.trim();
  const sessionId = (form.get("sessionId") as string | null)?.trim();

  const VoiceResponse = twilio.twiml.VoiceResponse;
  const response = new VoiceResponse();

  const callerId = process.env.TWILIO_CALLER_ID;
  if (!to) {
    response.say("No destination number provided.");
    return twiml(response);
  }

  if (!callerId) {
    response.say("Caller ID not configured.");
    return twiml(response);
  }

  const streamUrl = process.env.MEDIA_STREAM_WSS_URL?.trim();
  if (streamUrl && sessionId) {
    const start = response.start();
    const stream = start.stream({ url: streamUrl });
    stream.parameter({ name: "sessionId", value: sessionId });
  }

  const dial = response.dial({ callerId });
  dial.number(to);

  return twiml(response);
}

function twiml(response: twilio.twiml.VoiceResponse) {
  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
