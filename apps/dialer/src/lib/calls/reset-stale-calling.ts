import { createServerClient } from "@/lib/supabase/server";

const DEFAULT_STALE_MINUTES = 30;

export async function resetStaleCallingLeads(
  staleMinutes = DEFAULT_STALE_MINUTES,
): Promise<number> {
  const supabase = createServerClient();
  const cutoff = new Date(Date.now() - staleMinutes * 60_000).toISOString();

  const { data, error } = await supabase
    .from("leads")
    .update({ status: "New", status_changed_at: new Date().toISOString() })
    .eq("status", "Calling")
    .lt("status_changed_at", cutoff)
    .select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}
