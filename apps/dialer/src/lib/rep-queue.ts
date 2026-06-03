import type { DialerUsername } from "./dialer-auth";

/** Max callable New leads per rep; scraper stops Places API when both are full. */
export const MAX_NEW_PER_REP = 100;

export const DIALER_REPS: DialerUsername[] = ["david", "x"];

export function queueLabel(count: number): string {
  return `${count}/${MAX_NEW_PER_REP}`;
}

export function queueCountDisplay(
  count: number | null,
  opts: { testMode: boolean; storageConfigured?: boolean },
): string {
  if (opts.testMode) {
    if (opts.storageConfigured === false) {
      return "Queue offline";
    }
    return "Queue · preview";
  }
  if (count === null) return "Queue …";
  return `${queueLabel(count)} new`;
}
