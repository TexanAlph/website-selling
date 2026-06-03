"use client";

import type { CallPhase } from "@/hooks/usePhoneCall";
import type { Lead } from "@/lib/leads";
import { CoachPanel } from "./CoachPanel";
import { CallControlsBar } from "./CallControlsBar";
import { KeypadCoachToggle } from "./KeypadCoachToggle";

type Props = {
  callSource: "keypad" | "queue";
  callPhase: CallPhase;
  callStatusLabel: string;
  muted: boolean;
  testMode: boolean;
  lead: Lead | null;
  dialDisplay: string | null;
  sessionId: string | null;
  coachLeadId: string | null;
  coachNicheLabel: string | null;
  showCoach: boolean;
  keypadCoachThisCall: boolean;
  onKeypadCoachThisCallChange: (on: boolean) => void;
  onEndCall: () => void;
  onToggleMute: () => void;
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

export function InCallScreen({
  callSource,
  callPhase,
  callStatusLabel,
  muted,
  testMode,
  lead,
  dialDisplay,
  sessionId,
  coachLeadId,
  coachNicheLabel,
  showCoach,
  keypadCoachThisCall,
  onKeypadCoachThisCallChange,
  onEndCall,
  onToggleMute,
}: Props) {
  const status =
    callStatusLabel.trim() || phaseFallback(callPhase);
  const primaryNumber =
    callSource === "keypad"
      ? dialDisplay
      : lead?.phone
        ? lead.phone
        : null;
  const subtitle =
    callSource === "queue" && lead
      ? [lead.business_name, lead.niche?.trim()].filter(Boolean).join(" · ")
      : callSource === "keypad"
        ? "Keypad"
        : null;

  return (
    <div className="iphone-call-screen">
      <header className="iphone-call-screen__header">
        <p className="iphone-call-screen__status" aria-live="polite">
          <span className="call-active-ring" aria-hidden />
          {status}
        </p>
        {primaryNumber ? (
          <p className="iphone-call-screen__number dial-display dial-display--active">
            {primaryNumber}
          </p>
        ) : null}
        {subtitle ? (
          <p className="iphone-call-screen__subtitle">{subtitle}</p>
        ) : null}
      </header>

      <div className="iphone-call-screen__coach">
        {showCoach ? (
          <CoachPanel
            sessionId={sessionId}
            leadId={coachLeadId}
            nicheLabel={coachNicheLabel}
            active
            testMode={testMode}
            variant="phone"
          />
        ) : (
          <div className="keypad-coach-off iphone-call-screen__coach-off">
            <p className="keypad-coach-off__title">Regular call</p>
            <p className="keypad-coach-off__hint">
              AI coach is off. Turn it on below or set the default on Keypad
              before you dial.
            </p>
          </div>
        )}
      </div>

      <footer className="iphone-call-screen__footer">
        {callSource === "keypad" ? (
          <KeypadCoachToggle
            mode="thisCall"
            leadCallActive={false}
            thisCallOn={keypadCoachThisCall}
            onThisCallChange={onKeypadCoachThisCallChange}
            compact
          />
        ) : null}
        <CallControlsBar
          layout="dock"
          callPhase={callPhase}
          callStatusLabel=""
          muted={muted}
          testMode={testMode}
          onToggleMute={onToggleMute}
          onEndCall={onEndCall}
        />
      </footer>
    </div>
  );
}
