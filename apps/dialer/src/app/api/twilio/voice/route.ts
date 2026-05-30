import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";

/**
 * Twilio TwiML App Voice URL — dials the lead number from the browser client.
 * Configure in Twilio Console → TwiML Apps → Voice Request URL:
 *   https://YOUR_DOMAIN/api/twilio/voice
 */
export async function POST(request: NextRequest) {
  const form = await request.formData();
  const to = (form.get("To") as string | null)?.trim();

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

  const dial = response.dial({ callerId });
  dial.number(to);

  return twiml(response);
}

function twiml(response: twilio.twiml.VoiceResponse) {
  return new NextResponse(response.toString(), {
    headers: { "Content-Type": "text/xml" },
  });
}
