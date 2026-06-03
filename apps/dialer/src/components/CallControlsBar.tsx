"use client";

import type { CallPhase } from "@/hooks/usePhoneCall";

type Props = {
  callPhase: CallPhase;
  callStatusLabel: string;
  muted: boolean;
  testMode: boolean;
  onToggleMute: () => void;
  /** iPhone-style bottom dock: mute + red hang up */
  layout?: "inline" | "dock";
  onEndCall?: () => void;
};

function phaseFallback(phase: CallPhase): string {
  switch (phase) {
    case "connecting":
      return "Connecting…";
    case "ringing":
      return "Ringing…";
    case "connected":
      return "On call";
    case "disconnecting":
      return "Ending call…";
    default:
      return "On call";
  }
}

function MuteIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {muted ? (
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.48-.74 2.5-2.26 2.5-4.03 0-1.07-.35-2.06-.95-2.87L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
      ) : (
        <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20H8v2h8v-2h-3v-3.08c3.02-.43 5.42-2.78 5.91-5.78.09-.6-.39-1.14-1-1.14z" />
      )}
    </svg>
  );
}

function HangUpIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 9c-1.6 0-3.15.75-4.15 1.85l-1.3-1.3-2.32 2.32 1.41 1.41 1.15-1.15C10.85 9.75 11.42 9 12 9s1.15.75 1.65 1.44l1.15 1.15 1.41-1.41-2.32-2.32-1.3 1.3C15.15 9.75 13.6 9 12 9zm-6.3 3.26c2.2 4.08 5.56 7.44 9.64 9.64l2.06-2.06c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V21H4v-2c0-.55.45-1 1-1 1.24 0 2.45-.2 3.57-.57.35-.12.75-.03 1.02.24l2.06 2.06z" />
    </svg>
  );
}

export function CallControlsBar({
  callPhase,
  callStatusLabel,
  muted,
  testMode,
  onToggleMute,
  layout = "inline",
  onEndCall,
}: Props) {
  const label = callStatusLabel.trim() || phaseFallback(callPhase);
  const showControls =
    !testMode && (callPhase === "connected" || callPhase === "ringing");

  if (layout === "dock") {
    return (
      <div className="call-dock" role="group" aria-label="Call controls">
        {showControls ? (
          <button
            type="button"
            className={`call-dock-btn call-dock-btn--mute ${muted ? "call-dock-btn--active" : ""}`}
            onClick={() => onToggleMute()}
            aria-pressed={muted}
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          >
            <MuteIcon muted={muted} />
            <span>{muted ? "Unmute" : "Mute"}</span>
          </button>
        ) : (
          <div className="call-dock-spacer" aria-hidden />
        )}
        <button
          type="button"
          className="call-dock-btn call-dock-btn--end"
          onClick={() => onEndCall?.()}
          aria-label="End call"
        >
          <HangUpIcon />
          <span>End</span>
        </button>
        {showControls ? (
          <div className="call-dock-spacer" aria-hidden />
        ) : null}
      </div>
    );
  }

  return (
    <div className="call-status-bar" role="status" aria-live="polite">
      <div className="call-status-bar__main">
        <span className="call-active-ring" aria-hidden />
        <span className="call-status-bar__label">{label}</span>
      </div>
      {showControls ? (
        <div className="call-controls-actions">
          <button
            type="button"
            className={`call-control-btn call-control-btn--large ${muted ? "call-control-btn--active" : ""}`}
            onClick={() => onToggleMute()}
            aria-pressed={muted}
            aria-label={muted ? "Unmute microphone" : "Mute microphone"}
          >
            <MuteIcon muted={muted} />
            <span className="call-control-btn__label">{muted ? "Unmute" : "Mute"}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}
