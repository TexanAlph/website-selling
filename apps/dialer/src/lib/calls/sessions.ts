import type { LeadStatus } from "@/lib/leads";
import { createServerClient } from "@/lib/supabase/server";
import { normalizeNiche } from "./niche";
import type { CallSource, FinalizeCallInput, SessionRecap } from "./types";

export type { SessionRecap } from "./types";

export async function createCallSession(input: {
  sessionId: string;
  leadId?: string | null;
  niche?: string | null;
  source: CallSource;
  repName?: string | null;
}) {
  const supabase = createServerClient();
  const niche = normalizeNiche(input.niche);

  const { error } = await supabase.from("call_sessions").upsert(
    {
      id: input.sessionId,
      lead_id: input.leadId ?? null,
      niche: niche === "all" ? null : niche,
      call_source: input.source,
      rep_name: input.repName ?? null,
      started_at: new Date().toISOString(),
      analysis_status: "pending",
    },
    { onConflict: "id" },
  );

  if (error) throw new Error(error.message);
}

export async function aggregateSessionTranscript(
  sessionId: string,
): Promise<string> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("coach_messages")
    .select("content, created_at")
    .eq("session_id", sessionId)
    .eq("role", "transcript")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  if (!data?.length) return "";

  const parts: string[] = [];
  let last = "";
  for (const row of data) {
    const chunk = row.content?.trim() ?? "";
    if (!chunk || chunk === last) continue;
    parts.push(chunk);
    last = chunk;
  }
  return parts.join("\n");
}

export async function finalizeCallSession(
  sessionId: string,
  input: FinalizeCallInput,
) {
  const supabase = createServerClient();
  const endedAt = new Date();

  const { data: existing, error: fetchErr } = await supabase
    .from("call_sessions")
    .select(
      "started_at, ended_at, analysis_status, summary, rep_score, objections, recommendations, opener_suggestion, outcome_status, duration_seconds",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchErr) throw new Error(fetchErr.message);
  if (!existing) {
    await createCallSession({
      sessionId,
      source: "queue",
    });
  }

  if (existing?.ended_at) {
    return {
      alreadyEnded: true as const,
      recap: sessionRecapFromRow(existing),
    };
  }

  const startedAt = existing?.started_at
    ? new Date(existing.started_at)
    : endedAt;
  const durationSeconds = Math.max(
    0,
    Math.round((endedAt.getTime() - startedAt.getTime()) / 1000),
  );

  const transcriptFull = await aggregateSessionTranscript(sessionId);
  const outcomeStatus = input.outcomeStatus ?? null;

  const { error: updateErr } = await supabase
    .from("call_sessions")
    .update({
      ended_at: endedAt.toISOString(),
      outcome_status: outcomeStatus,
      duration_seconds: durationSeconds,
      transcript_full: transcriptFull || null,
      analysis_status: transcriptFull ? "pending" : "skipped",
    })
    .eq("id", sessionId);

  if (updateErr) throw new Error(updateErr.message);

  if (outcomeStatus) {
    const { data: sess } = await supabase
      .from("call_sessions")
      .select("lead_id")
      .eq("id", sessionId)
      .maybeSingle();

    await supabase.from("coach_messages").insert({
      session_id: sessionId,
      lead_id: sess?.lead_id ?? null,
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

function sessionRecapFromRow(row: {
  summary?: string | null;
  rep_score?: number | null;
  objections?: unknown;
  recommendations?: string | null;
  opener_suggestion?: string | null;
  outcome_status?: string | null;
  duration_seconds?: number | null;
  analysis_status?: string;
}): SessionRecap {
  const objections = Array.isArray(row.objections)
    ? (row.objections as string[])
    : [];
  return {
    summary: row.summary ?? null,
    repScore: row.rep_score ?? null,
    objections,
    recommendations: row.recommendations ?? null,
    openerSuggestion: row.opener_suggestion ?? null,
    outcomeStatus: row.outcome_status ?? null,
    durationSeconds: row.duration_seconds ?? null,
    analysisStatus: row.analysis_status ?? "pending",
  };
}

export async function getSessionRecap(
  sessionId: string,
): Promise<SessionRecap | null> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("call_sessions")
    .select(
      "summary, rep_score, objections, recommendations, opener_suggestion, outcome_status, duration_seconds, analysis_status, ended_at",
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error || !data?.ended_at) return null;
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
  const supabase = createServerClient();
  const { error } = await supabase
    .from("call_sessions")
    .update({
      ...patch,
      analyzed_at: patch.analyzed_at ?? new Date().toISOString(),
    })
    .eq("id", sessionId);

  if (error) throw new Error(error.message);
}

export async function getSessionForAnalysis(sessionId: string) {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("call_sessions")
    .select(
      "id, lead_id, niche, outcome_status, transcript_full, duration_seconds, call_source, rep_name",
    )
    .eq("id", sessionId)
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function fetchLeadContext(leadId: string | null) {
  if (!leadId) return null;
  const supabase = createServerClient();
  const { data } = await supabase
    .from("leads")
    .select("business_name, niche, website, status")
    .eq("id", leadId)
    .maybeSingle();
  return data;
}

export type OutcomeForPlaybook = LeadStatus | null;
