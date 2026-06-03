"use client";

import { useState } from "react";
import { formatDialDisplay, toOutboundE164 } from "@/lib/phone";
import type { CallPhase } from "@/hooks/usePhoneCall";
import { CallControlsBar } from "./CallControlsBar";
import { CoachPanel } from "./CoachPanel";
import { CallHistoryPanel } from "./CallHistoryPanel";
import type { Lead } from "@/lib/leads";

const KEYS: { digit: string; sub?: string }[] = [
  { digit: "1" },
  { digit: "2", sub: "ABC" },
  { digit: "3", sub: "DEF" },
  { digit: "4", sub: "GHI" },
  { digit: "5", sub: "JKL" },
  { digit: "6", sub: "MNO" },
  { digit: "7", sub: "PQRS" },
  { digit: "8", sub: "TUV" },
  { digit: "9", sub: "WXYZ" },
  { digit: "*" },
  { digit: "0", sub: "+" },
  { digit: "#" },
];

function PhoneIcon() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
    >
      <path d="M7.2 3.2c-.5.2-1 .6-1.2 1.1l-1.1 2.4c-.2.5-.1 1.1.3 1.5l1.6 1.6c2.4 2.4 4.3 4.3 6.7 6.7l1.6 1.6c.4.4 1 .5 1.5.3l2.4-1.1c.5-.2.9-.7 1.1-1.2l.5-1.8c.1-.4-.1-.8-.5-1L17.8 11c-.3-.2-.7-.2-1-.1l-1.2.5c-.8.3-1.7 0-2.3-.6l-2.2-2.2c-.6-.6-.9-1.5-.6-2.3l.5-1.2c.1-.3.1-.7-.1-1L8.2 3.7c-.2-.4-.6-.6-1-.5l-1.8.5z" />
    </svg>
  );
}

type Props = {
  testMode: boolean;
  deviceReady: boolean;
  calling: boolean;
  callPhase: CallPhase;
  callStatusLabel: string;
  speakerOn: boolean;
  speakerSupported: boolean;
  muted: boolean;
  sessionId: string | null;
  error: string | null;
  onStartCall: (e164: string) => void;
  onEndCall: () => void;
  onToggleSpeaker: () => void;
  onToggleMute: () => void;
  onCallBack: (phone: string) => void;
  onSelectRecentLead: (lead: Lead) => void;
};

export function PhoneKeypad({
  testMode,
  deviceReady,
  calling,
  callPhase,
  callStatusLabel,
  speakerOn,
  speakerSupported,
  muted,
  sessionId,
  error,
  onStartCall,
  onEndCall,
  onToggleSpeaker,
  onToggleMute,
  onCallBack,
  onSelectRecentLead,
}: Props) {
  const [raw, setRaw] = useState("");

  function append(ch: string) {
    if (calling) return;
    setRaw((r) => (r + ch).slice(0, 15));
  }

  function backspace() {
    if (calling) return;
    setRaw((r) => r.slice(0, -1));
  }

  const numericOnly = raw.replace(/[^\d]/g, "");
  const hasNumber = numericOnly.length > 0;
  const display = hasNumber ? formatDialDisplay(numericOnly) : null;
  const e164 = toOutboundE164(numericOnly);
  const canCall = Boolean(e164) && (testMode || deviceReady);

  function handleCall() {
    if (calling) {
      onEndCall();
      return;
    }
    if (!e164) return;
    onStartCall(e164);
  }

  if (calling) {
    return (
      <div className="keypad-shell min-h-0">
        <div className="keypad-display">
          <CallControlsBar
            callPhase={callPhase}
            callStatusLabel={callStatusLabel}
            speakerOn={speakerOn}
            speakerSupported={speakerSupported}
            muted={muted}
            testMode={testMode}
            onToggleSpeaker={onToggleSpeaker}
            onToggleMute={onToggleMute}
          />
          <p className="dial-display dial-display--active">{display}</p>
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">
          <CoachPanel
            sessionId={sessionId}
            leadId={null}
            active={calling}
            testMode={testMode}
          />
        </div>
        <div className="keypad-actions shrink-0 pt-2">
          <span />
          <button
            type="button"
            onClick={handleCall}
            className="keypad-action-btn keypad-action-call btn-call btn-call--end"
            aria-label="End call"
          >
            <span className="keypad-action-label">End call</span>
          </button>
          <span />
        </div>
      </div>
    );
  }

  return (
    <div className="keypad-shell keypad-shell--with-history">
      <div className="keypad-main">
      <div className="keypad-display">
        {!deviceReady && !testMode && (
          <span className="keypad-status">Connecting…</span>
        )}
        <p
          className={`dial-display w-full text-center ${
            display ? "dial-display--active" : "dial-display--empty"
          }`}
        >
          {display ?? "Enter number"}
        </p>
      </div>

      {error && (
        <p className="alert-error mx-1 mb-1 shrink-0 text-center text-xs">
          {error}
        </p>
      )}

      <div className="keypad-grid min-h-0 flex-1 content-center overflow-hidden">
        {KEYS.map(({ digit, sub }) => (
          <button
            key={digit}
            type="button"
            disabled={calling}
            onClick={() => append(digit)}
            className="keypad-key"
          >
            <span className="keypad-digit">{digit}</span>
            {sub ? <span className="keypad-sub">{sub}</span> : null}
          </button>
        ))}
      </div>

      <div className="keypad-actions shrink-0">
        <button
          type="button"
          disabled={!raw}
          onClick={() => setRaw("")}
          className="keypad-action-btn keypad-action-secondary"
          aria-label="Clear number"
        >
          <span className="keypad-action-clear-x">×</span>
          <span className="keypad-action-label">Clear</span>
        </button>

        <button
          type="button"
          disabled={!canCall}
          onClick={handleCall}
          className="keypad-action-btn keypad-action-call btn-call"
          aria-label="Call"
        >
          <PhoneIcon />
          <span className="keypad-action-label keypad-action-label--call">Call</span>
        </button>

        <button
          type="button"
          disabled={!raw}
          onClick={backspace}
          className="keypad-action-btn keypad-action-secondary keypad-action-delete"
          aria-label="Delete last digit"
        >
          <span className="keypad-delete-symbol" aria-hidden>
            ⌫
          </span>
          <span className="keypad-action-label">Delete</span>
        </button>
      </div>
      </div>
      <CallHistoryPanel
        testMode={testMode}
        onSelectLead={onSelectRecentLead}
        onCallBack={onCallBack}
        compact
      />
    </div>
  );
}
