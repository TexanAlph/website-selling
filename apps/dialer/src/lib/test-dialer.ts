import type { Lead } from "@/lib/leads";
import { isStorageConfigured } from "@/lib/storage/client";

/**
 * Test mode when explicitly enabled OR Mac Mini storage API is not configured.
 * Set STORAGE_API_URL + STORAGE_API_SECRET on Vercel (tunnel to Mac Mini).
 */
export function isTestDialerMode(): boolean {
  if (process.env.NEXT_PUBLIC_DIALER_TEST_MODE === "true") return true;
  if (process.env.NEXT_PUBLIC_DIALER_TEST_MODE === "false") return false;
  return !isStorageConfigured();
}

export function isStorageReady(): boolean {
  return isStorageConfigured();
}

/** In-memory lead for UI/call/coach testing — not stored on Mac Mini */
export const MOCK_TEST_LEAD: Lead = {
  id: "00000000-0000-0000-0000-000000000099",
  business_name: "Test Roofing Co (San Antonio)",
  phone: "+12105551234",
  website: null,
  status: "New",
  niche: "roofing contractor",
  assigned_rep: "roslyn",
  created_at: new Date().toISOString(),
};
