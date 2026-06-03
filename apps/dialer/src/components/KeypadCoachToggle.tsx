"use client";

import { useKeypadCoachEnabled } from "@/hooks/useKeypadCoachEnabled";

type Props = {
  /** Lead calls always use coach — show note instead of a control */
  leadCallActive?: boolean;
  compact?: boolean;
};

export function KeypadCoachToggle({
  leadCallActive = false,
  compact = false,
}: Props) {
  const { enabled, setEnabled, ready } = useKeypadCoachEnabled();

  if (!ready) return null;

  if (leadCallActive) {
    return (
      <p className="keypad-coach-toggle-note">
        AI coach on for lead calls
      </p>
    );
  }

  return (
    <label
      className={`keypad-coach-toggle${compact ? " keypad-coach-toggle--compact" : ""}`}
    >
      <span className="keypad-coach-toggle__text">
        <span className="keypad-coach-toggle__label">AI coach</span>
        <span className="keypad-coach-toggle__sub">
          {compact
            ? "Tap off anytime — stops Say now & OpenRouter"
            : "Say now on all tabs during keypad calls"}
        </span>
      </span>
      <input
        type="checkbox"
        className="keypad-coach-toggle__input"
        checked={enabled}
        onChange={(e) => setEnabled(e.target.checked)}
        aria-label="AI coach on keypad calls"
      />
    </label>
  );
}
