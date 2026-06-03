import type { Lead, LeadStatus } from "@/lib/leads";

export function isStorageConfigured(): boolean {
  const url = process.env.STORAGE_API_URL?.trim() ?? "";
  const secret = process.env.STORAGE_API_SECRET?.trim() ?? "";
  return (
    Boolean(url && secret) &&
    !url.includes("YOUR_") &&
    !url.includes("your-")
  );
}

function baseUrl(): string {
  const url = process.env.STORAGE_API_URL?.trim().replace(/\/$/, "");
  if (!url || url.includes("YOUR_")) {
    throw new Error(
      "Set STORAGE_API_URL to your Mac Mini API (Cloudflare Tunnel HTTPS URL)",
    );
  }
  return url;
}

function apiSecret(): string {
  const s = process.env.STORAGE_API_SECRET?.trim();
  if (!s) throw new Error("Set STORAGE_API_SECRET (same value on Mac Mini + Vercel)");
  return s;
}

async function storageFetch<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiSecret()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = { error: text };
    }
  }
  if (!res.ok) {
    const err =
      body && typeof body === "object" && "detail" in body
        ? String((body as { detail: unknown }).detail)
        : body && typeof body === "object" && "error" in body
          ? String((body as { error: unknown }).error)
          : `Storage API ${res.status}`;
    throw new Error(err);
  }
  return body as T;
}

export async function getNextLead(rep: string): Promise<{
  lead: Lead | null;
  queueCount: number;
}> {
  return storageFetch(`/leads/next?rep=${encodeURIComponent(rep)}`);
}

export async function countNewLeads(rep: string): Promise<number> {
  const { queueCount } = await storageFetch<{ queueCount: number }>(
    `/leads/count?rep=${encodeURIComponent(rep)}`,
  );
  return queueCount;
}

export async function listRecentLeads(rep: string, limit = 25): Promise<Lead[]> {
  const { leads } = await storageFetch<{ leads: Lead[] }>(
    `/leads/recent?rep=${encodeURIComponent(rep)}&limit=${limit}`,
  );
  return leads ?? [];
}

export async function updateLeadStatus(
  leadId: string,
  status: LeadStatus,
  rep: string,
  claimOnly = false,
): Promise<void> {
  await storageFetch(`/leads/${leadId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, rep, claim_only: claimOnly }),
  });
}

export async function resetStaleCallingLeads(
  staleMinutes = 30,
): Promise<number> {
  const { reset } = await storageFetch<{ reset: number }>(
    `/leads/reset-stale-calling?stale_minutes=${staleMinutes}`,
    { method: "POST" },
  );
  return reset;
}

export async function fetchLeadContext(leadId: string | null) {
  if (!leadId) return null;
  const row = await storageFetch<{
    business_name: string;
    niche: string | null;
    website: string | null;
    status: string;
  }>(`/leads/${leadId}`);
  return row;
}

export async function upsertCallSession(payload: {
  id: string;
  lead_id?: string | null;
  niche?: string | null;
  call_source: string;
  rep_name?: string | null;
  started_at?: string;
  analysis_status?: string;
}) {
  await storageFetch("/call-sessions", {
    method: "POST",
    body: JSON.stringify({
      ...payload,
      lead_id: payload.lead_id ?? null,
    }),
  });
}

export async function getCallSession(sessionId: string) {
  return storageFetch<Record<string, unknown>>(`/call-sessions/${sessionId}`);
}

export async function updateCallSession(
  sessionId: string,
  patch: Record<string, unknown>,
) {
  await storageFetch(`/call-sessions/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function aggregateSessionTranscript(
  sessionId: string,
): Promise<string> {
  const { transcript } = await storageFetch<{ transcript: string }>(
    `/coach-messages/transcript-aggregate?session_id=${encodeURIComponent(sessionId)}`,
  );
  return transcript;
}

export async function listPendingAnalysis(limit = 25) {
  const { sessions } = await storageFetch<{ sessions: { id: string }[] }>(
    `/call-sessions/pending-analysis?limit=${limit}`,
  );
  return sessions;
}

export async function listCompletedSessionsSince(sinceIso: string) {
  const { sessions } = await storageFetch<{
    sessions: Array<{
      outcome_status: string | null;
      niche: string | null;
      rep_score: number | null;
      summary: string | null;
      objections: unknown;
      duration_seconds: number | null;
    }>;
  }>(`/call-sessions/completed-since?since=${encodeURIComponent(sinceIso)}`);
  return sessions;
}

export async function insertCoachMessage(input: {
  session_id: string;
  lead_id?: string | null;
  role: string;
  content: string;
}) {
  return storageFetch<{
    id: string;
    role: string;
    content: string;
    created_at: string;
  }>("/coach-messages", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getLatestCounterContent(
  sessionId: string,
): Promise<string | null> {
  const { counter } = await storageFetch<{ counter: { content: string } | null }>(
    `/coach-messages/latest-counter?session_id=${encodeURIComponent(sessionId)}`,
  );
  return counter?.content ?? null;
}

export async function listCoachCountersSince(
  sessionId: string,
  since?: string,
) {
  const q = new URLSearchParams({ session_id: sessionId });
  if (since) q.set("since", since);
  const { messages } = await storageFetch<{
    messages: Array<{
      id: string;
      role: string;
      content: string;
      created_at: string;
    }>;
  }>(`/coach-messages/counters?${q}`);
  return messages;
}

export async function listMediaLines(sessionId: string) {
  const { lines } = await storageFetch<{
    lines: Array<{ role: string; content: string; created_at: string }>;
  }>(
    `/coach-messages/media-lines?session_id=${encodeURIComponent(sessionId)}`,
  );
  return lines;
}

export async function getPlaybookForNiche(niche: string) {
  const { entries } = await storageFetch<{
    entries: Array<{
      objection_pattern: string;
      winning_response: string;
      score: number;
    }>;
  }>(`/playbook?niche=${encodeURIComponent(niche)}`);
  return entries;
}

export async function upsertPlaybookEntryApi(input: {
  niche: string;
  objection_pattern: string;
  winning_response: string;
  source_session_id?: string | null;
  won: boolean;
}) {
  await storageFetch("/playbook", {
    method: "POST",
    body: JSON.stringify({
      niche: input.niche,
      objection_pattern: input.objection_pattern,
      winning_response: input.winning_response,
      source_session_id: input.source_session_id ?? null,
      won: input.won,
    }),
  });
}

export async function bumpPlaybookOutcomesApi(
  niche: string,
  outcomeStatus: string,
) {
  await storageFetch(
    `/playbook/bump-outcomes?niche=${encodeURIComponent(niche)}&outcome_status=${encodeURIComponent(outcomeStatus)}`,
    { method: "POST" },
  );
}

export async function getInsightsPayload() {
  return storageFetch<{
    dailyInsight: {
      report_date: string;
      content: Record<string, unknown>;
      created_at: string;
    } | null;
    lastScraperRun: {
      started_at: string;
      finished_at: string | null;
      status: string;
      leads_upserted: number;
      error_message: string | null;
    } | null;
  }>("/insights");
}

export async function dailyInsightExists(reportDate: string) {
  const { exists } = await storageFetch<{ exists: boolean }>(
    `/daily-insights/exists?report_date=${encodeURIComponent(reportDate)}`,
  );
  return exists;
}

export async function insertDailyInsight(
  reportDate: string,
  content: Record<string, unknown>,
) {
  await storageFetch("/daily-insights", {
    method: "POST",
    body: JSON.stringify({ report_date: reportDate, content }),
  });
}

export async function getLatestScraperRun() {
  const { run } = await storageFetch<{ run: Record<string, unknown> | null }>(
    "/scraper-runs/latest",
  );
  return run;
}

export async function insertCoachFeedback(input: {
  session_id: string;
  message_id?: string | null;
  rep_name: string;
  helpful: boolean;
}) {
  await storageFetch("/coach-feedback", {
    method: "POST",
    body: JSON.stringify(input),
  });
}
