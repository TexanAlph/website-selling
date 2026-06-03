import type { LabeledLine } from "@/lib/coach/types";

export function buildCoachTranscriptFromLines(lines: LabeledLine[]): {
  transcript: string;
  prospectOnly: string;
} {
  const prospectOnly = lines
    .filter((l) => l.speaker === "prospect" && l.text.trim())
    .map((l) => l.text.trim())
    .join(" ");

  const transcript = lines
    .filter((l) => l.text.trim())
    .map((l) => {
      const who =
        l.speaker === "prospect"
          ? "Prospect"
          : l.speaker === "rep"
            ? "You"
            : "Audio";
      return `${who}: ${l.text.trim()}`;
    })
    .join("\n");

  return { transcript, prospectOnly };
}

/** Fingerprint for debouncing duplicate coach requests. */
export function coachTranscriptFingerprint(
  transcript: string,
  prospectOnly?: string,
): string {
  const p = prospectOnly?.trim().slice(-400) ?? "";
  const t = transcript.trim().slice(-500);
  return p ? `p:${p}` : `t:${t}`;
}
