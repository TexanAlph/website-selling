import { NextResponse } from "next/server";
import twilio from "twilio";
import { getSessionUser } from "@/lib/dialer-session";

export async function GET() {
  const rep = await getSessionUser();
  if (!rep) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKey = process.env.TWILIO_API_KEY;
  const apiSecret = process.env.TWILIO_API_SECRET;
  const twimlAppSid = process.env.TWILIO_TWIML_APP_SID;

  if (!accountSid || !apiKey || !apiSecret || !twimlAppSid) {
    return NextResponse.json(
      { error: "Twilio env vars not configured" },
      { status: 500 },
    );
  }

  const identity = rep;

  const AccessToken = twilio.jwt.AccessToken;
  const VoiceGrant = AccessToken.VoiceGrant;

  const token = new AccessToken(accountSid, apiKey, apiSecret, {
    identity,
    ttl: 3600,
  });

  const voiceGrant = new VoiceGrant({
    outgoingApplicationSid: twimlAppSid,
    incomingAllow: false,
  });
  token.addGrant(voiceGrant);

  return NextResponse.json({
    token: token.toJwt(),
    identity,
  });
}
