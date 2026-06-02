import type { LeadStatus } from "@/lib/leads";
import type { SessionRecap } from "@/lib/calls/types";
import type { CallSource } from "./types";

export async function apiCreateCallSession(input: {
  sessionId: string;
  leadId?: string | null;
  niche?: string | null;
  source: CallSource;
}) {
  const res = await fetch("/api/calls/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Failed to start call session");
  }
}

export type FinalizeResponse = {
  ok: boolean;
  alreadyEnded?: boolean;
  analysisQueued?: boolean;
  recap?: SessionRecap | null;
};

export async function apiFinalizeCallSession(
  sessionId: string,
  input: {
    outcomeStatus?: LeadStatus | null;
    endReason: "outcome" | "hangup" | "manual";
  },
): Promise<FinalizeResponse> {
  const res = await fetch(`/api/calls/session/${sessionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(json.error ?? "Failed to finalize call");
  }
  return json as FinalizeResponse;
}
