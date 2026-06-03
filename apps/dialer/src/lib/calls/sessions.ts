import type { LeadStatus } from "@/lib/leads";
import { normalizeNiche } from "./niche";
import type { CallSource, FinalizeCallInput, SessionRecap } from "./types";
import * as storage from "@/lib/storage/client";

export type { SessionRecap } from "./types";

export async function createCallSession(input: {
  sessionId: string;
  leadId?: string | null;
  niche?: string | null;
  source: CallSource;
  repName?: string | null;
  dialedPhone?: string | null;
}) {
  const niche = normalizeNiche(input.niche);
  await storage.upsertCallSession({
    id: input.sessionId,
    lead_id: input.leadId ?? null,
    niche: niche === "all" ? null : niche,
    call_source: input.source,
    dialed_phone: input.dialedPhone ?? null,
    rep_name: input.repName ?? null,
    started_at: new Date().toISOString(),
    analysis_status: "pending",
  });
}

export async function aggregateSessionTranscript(
  sessionId: string,
): Promise<string> {
  return storage.aggregateSessionTranscript(sessionId);
}

export async function finalizeCallSession(
  sessionId: string,
  input: FinalizeCallInput,
) {
  const endedAt = new Date();

  let existing = await storage.getCallSession(sessionId).catch(() => null);

  if (!existing) {
    await createCallSession({
      sessionId,
      source: "queue",
    });
    existing = await storage.getCallSession(sessionId);
  }

  if (existing?.ended_at) {
    return {
      alreadyEnded: true as const,
      recap: sessionRecapFromRow(existing),
    };
  }

  const startedAt = existing?.started_at
    ? new Date(String(existing.started_at))
    : endedAt;
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
  );

  const transcriptFull = await aggregateSessionTranscript(sessionId);
  const outcomeStatus = input.outcomeStatus ?? null;

  await storage.updateCallSession(sessionId, {
    ended_at: endedAt.toISOString(),
    outcome_status: outcomeStatus,
    duration_seconds: durationSeconds,
    transcript_full: transcriptFull || null,
    analysis_status: transcriptFull ? "pending" : "skipped",
  });

  if (outcomeStatus) {
    const leadId = existing?.lead_id ? String(existing.lead_id) : null;
    await storage.insertCoachMessage({
      session_id: sessionId,
      lead_id: leadId,
      role: "outcome",
      content: outcomeStatus,
    });
  }

  return {
    alreadyEnded: false as const,
    durationSeconds,
    transcriptFull,
    outcomeStatus,
    recap: null,
  };
}

function sessionRecapFromRow(row: Record<string, unknown>): SessionRecap {
  const objections = Array.isArray(row.objections)
    ? (row.objections as string[])
    : [];
  return {
    summary: (row.summary as string) ?? null,
    repScore: (row.rep_score as number) ?? null,
    objections,
    recommendations: (row.recommendations as string) ?? null,
    openerSuggestion: (row.opener_suggestion as string) ?? null,
    outcomeStatus: (row.outcome_status as string) ?? null,
    durationSeconds: (row.duration_seconds as number) ?? null,
    analysisStatus: (row.analysis_status as string) ?? "pending",
  };
}

export async function getSessionRecap(
  sessionId: string,
): Promise<SessionRecap | null> {
  const data = await storage.getCallSession(sessionId).catch(() => null);
  if (!data?.ended_at) return null;
  return sessionRecapFromRow(data);
}

export async function markSessionAnalysis(
  sessionId: string,
  patch: {
    analysis_status: string;
    summary?: string | null;
    objections?: string[] | null;
    rep_score?: number | null;
    recommendations?: string | null;
    opener_suggestion?: string | null;
    analyzed_at?: string;
  },
) {
  await storage.updateCallSession(sessionId, {
    ...patch,
    analyzed_at: patch.analyzed_at ?? new Date().toISOString(),
  });
}

export async function getSessionForAnalysis(sessionId: string) {
  const data = await storage.getCallSession(sessionId);
  return {
    id: data.id as string,
    lead_id: data.lead_id as string | null,
    niche: data.niche as string | null,
    outcome_status: data.outcome_status as string | null,
    transcript_full: data.transcript_full as string | null,
    duration_seconds: data.duration_seconds as number | null,
    call_source: data.call_source as string,
    rep_name: data.rep_name as string | null,
  };
}

export async function fetchLeadContext(leadId: string | null) {
  return storage.fetchLeadContext(leadId);
}

export type OutcomeForPlaybook = LeadStatus | null;
