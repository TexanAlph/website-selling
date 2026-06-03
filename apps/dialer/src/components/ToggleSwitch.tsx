"use client";

type Props = {
  checked: boolean;
  onChange: (on: boolean) => void;
  ariaLabel: string;
  disabled?: boolean;
};

export function ToggleSwitch({
  checked,
  onChange,
  ariaLabel,
  disabled = false,
}: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      className={`toggle-switch${checked ? " toggle-switch--on" : ""}`}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-switch__track" aria-hidden>
        <span className="toggle-switch__thumb" />
      </span>
      <span className="toggle-switch__state" aria-hidden>
        {checked ? "On" : "Off"}
      </span>
    </button>
  );
}
