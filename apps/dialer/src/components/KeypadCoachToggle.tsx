"use client";

import { useKeypadCoachDefault } from "@/hooks/useKeypadCoachDefault";
import { ToggleSwitch } from "./ToggleSwitch";

type Props = {
  leadCallActive?: boolean;
  compact?: boolean;
  /** Idle keypad: sets default for the next dial. In-call: this call only. */
  mode: "default" | "thisCall";
  thisCallOn?: boolean;
  onThisCallChange?: (on: boolean) => void;
};

export function KeypadCoachToggle({
  leadCallActive = false,
  compact = false,
  mode,
  thisCallOn = true,
  onThisCallChange,
}: Props) {
  const { defaultOn, setDefaultOn, ready } = useKeypadCoachDefault();

  if (!ready && mode === "default") return null;

  if (leadCallActive) {
    return (
      <p className="keypad-coach-toggle-note">
        AI coach on for lead calls
      </p>
    );
  }

  const checked = mode === "thisCall" ? thisCallOn : defaultOn;
  const onChange = (on: boolean) => {
    if (mode === "thisCall") onThisCallChange?.(on);
    else setDefaultOn(on);
  };

  const sub =
    mode === "thisCall"
      ? compact
        ? "This call only — off saves API usage"
        : "This call only"
      : "Default for your next keypad call";

  const ariaLabel =
    mode === "thisCall"
      ? "AI coach for this call"
      : "Default AI coach for next keypad call";

  return (
    <div
      className={`keypad-coach-toggle${compact ? " keypad-coach-toggle--compact" : ""}`}
    >
      <div className="keypad-coach-toggle__text">
        <span className="keypad-coach-toggle__label">AI coach</span>
        <span className="keypad-coach-toggle__sub">{sub}</span>
      </div>
      <ToggleSwitch
        checked={checked}
        onChange={onChange}
        ariaLabel={ariaLabel}
      />
    </div>
  );
}
