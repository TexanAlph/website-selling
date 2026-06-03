import { NextResponse } from "next/server";
import { isStorageConfigured } from "@/lib/storage/client";

export async function GET() {
  const storageConfigured = isStorageConfigured();
  const explicitTest = process.env.NEXT_PUBLIC_DIALER_TEST_MODE === "true";
  const forceProd = process.env.NEXT_PUBLIC_DIALER_TEST_MODE === "false";

  const testMode = explicitTest || (!forceProd && !storageConfigured);

  const twilioConfigured = Boolean(
    process.env.TWILIO_ACCOUNT_SID?.trim() &&
      process.env.TWILIO_API_KEY?.trim() &&
      process.env.TWILIO_API_SECRET?.trim() &&
      process.env.TWILIO_TWIML_APP_SID?.trim() &&
      process.env.TWILIO_CALLER_ID?.trim(),
  );

  return NextResponse.json({
    testMode,
    storageConfigured,
    twilioConfigured,
  });
}
