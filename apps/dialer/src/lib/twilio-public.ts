import type { NextRequest } from "next/server";

export function twilioPublicBaseUrl(request: NextRequest): string {
  const host =
    request.headers.get("x-forwarded-host") ??
    request.headers.get("host") ??
    process.env.VERCEL_URL;
  if (!host) return "https://localhost:3002";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const clean = host.replace(/^https?:\/\//, "");
  return `${proto}://${clean}`;
}

export function twilioWebhookSecret(): string | null {
  return (
    process.env.TWILIO_WEBHOOK_SECRET?.trim() ||
    process.env.STORAGE_API_SECRET?.trim() ||
    null
  );
}

export function verifyTwilioWebhookKey(
  request: NextRequest,
  key: string | null,
): boolean {
  const expected = twilioWebhookSecret();
  if (!expected) return false;
  return key === expected;
}
