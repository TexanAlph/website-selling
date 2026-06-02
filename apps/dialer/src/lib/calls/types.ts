import type { LeadStatus } from "@/lib/leads";

export type CallSource = "queue" | "keypad";

export type CallSessionRow = {
  id: string;
  lead_id: string | null;
  niche: string | null;
  call_source: CallSource;
  started_at: string;
  ended_at: string | null;
  outcome_status: LeadStatus | null;
  duration_seconds: number | null;
  transcript_full: string | null;
  summary: string | null;
  objections: string[] | null;
  rep_score: number | null;
  recommendations: string | null;
  opener_suggestion: string | null;
  analysis_status: string;
  analyzed_at: string | null;
};

export type FinalizeCallInput = {
  outcomeStatus?: LeadStatus | null;
  endReason: "outcome" | "hangup" | "manual";
};

export type SessionRecap = {
  summary: string | null;
  repScore: number | null;
  objections: string[];
  recommendations: string | null;
  openerSuggestion: string | null;
  outcomeStatus: string | null;
  durationSeconds: number | null;
  analysisStatus: string;
};
