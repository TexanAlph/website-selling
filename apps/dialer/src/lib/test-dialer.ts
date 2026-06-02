import type { Lead } from "@/lib/leads";

function supabaseConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  return (
    Boolean(url && key) &&
    !url.includes("YOUR_PROJECT") &&
    !key.includes("your_")
  );
}

/**
 * Test mode only when explicitly enabled OR Supabase is not configured.
 * You do not need NEXT_PUBLIC_DIALER_TEST_MODE=false in production —
 * real Supabase URL + anon key automatically use the live stack.
 */
export function isTestDialerMode(): boolean {
  if (process.env.NEXT_PUBLIC_DIALER_TEST_MODE === "true") return true;
  if (process.env.NEXT_PUBLIC_DIALER_TEST_MODE === "false") return false;
  return !supabaseConfigured();
}

export function isSupabaseReady(): boolean {
  return supabaseConfigured();
}

/** In-memory lead for UI/call/coach testing — not stored in Supabase */
export const MOCK_TEST_LEAD: Lead = {
  id: "00000000-0000-0000-0000-000000000099",
  business_name: "Test Roofing Co (San Antonio)",
  phone: "+12105551234",
  website: null,
  status: "New",
  niche: "roofing contractor",
  assigned_rep: "david",
  created_at: new Date().toISOString(),
};
