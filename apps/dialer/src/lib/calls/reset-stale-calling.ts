import { resetStaleCallingLeads as resetViaStorage } from "@/lib/storage/client";

const DEFAULT_STALE_MINUTES = 30;

export async function resetStaleCallingLeads(
  staleMinutes = DEFAULT_STALE_MINUTES,
): Promise<number> {
  return resetViaStorage(staleMinutes);
}
