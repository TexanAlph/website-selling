"use client";

import type { CallPhase } from "@/hooks/usePhoneCall";

type Props = {
  callPhase: CallPhase;
  callStatusLabel: string;
  speakerOn: boolean;
  speakerSupported: boolean;
  testMode: boolean;
  onToggleSpeaker: () => void;
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

function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      {on ? (
        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.06c1.48-.74 2.5-2.26 2.5-4.03zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
      ) : (
        <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.48-.74 2.5-2.26 2.5-4.03 0-1.07-.35-2.06-.95-2.87L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
      )}
    </svg>
  );
}

export function CallStatusBar({
  callPhase,
  callStatusLabel,
  speakerOn,
  speakerSupported,
  testMode,
  onToggleSpeaker,
}: Props) {
  const label = callStatusLabel.trim() || phaseFallback(callPhase);
  const showSpeaker = !testMode && callPhase === "connected";

  return (
    <div className="call-status-bar" role="status" aria-live="polite">
      <div className="call-status-bar__main">
        <span className="call-active-ring" aria-hidden />
        <span className="call-status-bar__label">{label}</span>
      </div>
      {showSpeaker ? (
        <button
          type="button"
          className="call-status-bar__speaker"
          onClick={() => onToggleSpeaker()}
          aria-pressed={speakerOn}
          aria-label={speakerOn ? "Speaker on" : "Speaker off"}
          title={
            speakerSupported
              ? speakerOn
                ? "Route audio to speaker"
                : "Route audio to earpiece"
              : "Use iPhone call bar for speaker"
          }
        >
          <SpeakerIcon on={speakerOn} />
          <span className="call-status-bar__speaker-text">Speaker</span>
        </button>
      ) : null}
    </div>
  );
}
