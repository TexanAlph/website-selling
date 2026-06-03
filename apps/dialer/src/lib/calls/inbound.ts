export type MissedCall = {
  id: string;
  from_phone: string;
  call_sid: string | null;
  recording_sid: string | null;
  recording_url: string | null;
  duration_seconds: number | null;
  business_name: string | null;
  listened_at: string | null;
  created_at: string;
};

export function missedCallLabel(call: MissedCall): string {
  return call.business_name?.trim() || call.from_phone;
}

export function isMissedUnread(call: MissedCall): boolean {
  return !call.listened_at;
}

export function hasVoicemail(call: MissedCall): boolean {
  return Boolean(call.recording_sid || call.recording_url);
}
