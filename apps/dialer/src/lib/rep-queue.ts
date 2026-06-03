import type { DialerUsername } from "./dialer-auth";

/** Max callable New leads per rep; scraper stops Places API when both are full. */
export const MAX_NEW_PER_REP = 100;

export const DIALER_REPS: DialerUsername[] = ["david", "roslyn"];

export function queueCountDisplay(
  count: number | null,
  opts: { testMode: boolean; storageConfigured?: boolean },
): { primary: string; secondary: string | null } {
  if (opts.testMode) {
    if (opts.storageConfigured === false) {
      return { primary: "Queue offline", secondary: null };
    }
    return { primary: "Preview mode", secondary: "Connect storage for live queue" };
  }
  if (count === null) {
    return { primary: "Loading queue…", secondary: null };
  }
  const primary =
    count === 1 ? "1 lead ready" : `${count} leads ready`;
  const secondary =
    count >= MAX_NEW_PER_REP
      ? "Queue full — log outcomes to get more"
      : null;
  return { primary, secondary };
}
