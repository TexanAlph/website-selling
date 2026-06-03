import type { CallSource } from "./types";

export type OutboundCallRecord = {
  id: string;
  callSource: CallSource;
  dialedPhone: string | null;
  leadId: string | null;
  leadBusinessName: string | null;
  leadPhone: string | null;
  outcomeStatus: string | null;
  durationSeconds: number | null;
  endedAt: string;
  startedAt: string;
};

export function outboundCallLabel(call: OutboundCallRecord): string {
  if (call.leadBusinessName?.trim()) {
    return call.leadBusinessName.trim();
  }
  if (call.dialedPhone?.trim()) {
    return call.dialedPhone.trim();
  }
  return call.callSource === "keypad" ? "Keypad call" : "Outbound call";
}

export function outboundCallPhone(call: OutboundCallRecord): string | null {
  return (
    call.dialedPhone?.trim() ||
    call.leadPhone?.trim() ||
    null
  );
}

export function mapOutboundCallRow(row: Record<string, unknown>): OutboundCallRecord {
  return {
    id: String(row.id),
    callSource: row.call_source as CallSource,
    dialedPhone: row.dialed_phone ? String(row.dialed_phone) : null,
    leadId: row.lead_id ? String(row.lead_id) : null,
    leadBusinessName: row.lead_business_name
      ? String(row.lead_business_name)
      : null,
    leadPhone: row.lead_phone ? String(row.lead_phone) : null,
    outcomeStatus: row.outcome_status ? String(row.outcome_status) : null,
    durationSeconds:
      typeof row.duration_seconds === "number"
        ? row.duration_seconds
        : row.duration_seconds != null
          ? Number(row.duration_seconds)
          : null,
    endedAt: String(row.ended_at),
    startedAt: String(row.started_at),
  };
}
