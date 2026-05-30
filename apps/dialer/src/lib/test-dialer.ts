import type { Lead } from "@/lib/leads";

export function isTestDialerMode(): boolean {
  return process.env.NEXT_PUBLIC_DIALER_TEST_MODE === "true";
}

/** In-memory lead for UI/call/coach testing — not stored in Supabase */
export const MOCK_TEST_LEAD: Lead = {
  id: "00000000-0000-0000-0000-000000000099",
  business_name: "Test Roofing Co (San Antonio)",
  phone: "+12105551234",
  website: null,
  status: "New",
  niche: "roofing contractor",
  created_at: new Date().toISOString(),
};
