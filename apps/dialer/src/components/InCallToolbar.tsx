"use client";

import type { CallPhase } from "@/hooks/usePhoneCall";
import type { Lead } from "@/lib/leads";
import { CallControlsBar } from "./CallControlsBar";
import { KeypadCoachToggle } from "./KeypadCoachToggle";

type Props = {
  callSource: "keypad" | "queue";
  callPhase: CallPhase;
  callStatusLabel: string;
  speakerOn: boolean;
  speakerSupported: boolean;
  muted: boolean;
  testMode: boolean;
  lead: Lead | null;
  dialDisplay: string | null;
  onEndCall: () => void;
  onToggleSpeaker: () => void;
  onToggleMute: () => void;
};

export function InCallToolbar({
  callSource,
  callPhase,
  callStatusLabel,
  speakerOn,
  speakerSupported,
  muted,
  testMode,
  lead,
  dialDisplay,
  onEndCall,
  onToggleSpeaker,
  onToggleMute,
}: Props) {
  return (
    <div className="in-call-toolbar glass">
      <div className="in-call-toolbar__top">
        <span className="in-call-toolbar__source">
          {callSource === "queue" ? "Lead call" : "Keypad call"}
        </span>
        <button
          type="button"
          onClick={onEndCall}
          className="btn-primary leads-call-btn btn-primary--end in-call-toolbar__end"
        >
          End call
        </button>
      </div>
      {callSource === "queue" && lead ? (
        <p className="in-call-toolbar__lead">
          {lead.business_name}
          {lead.phone ? ` · ${lead.phone}` : ""}
        </p>
      ) : null}
      {callSource === "keypad" && dialDisplay ? (
        <p className="in-call-toolbar__dial dial-display dial-display--active">
          {dialDisplay}
        </p>
      ) : null}
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
      <KeypadCoachToggle
        leadCallActive={callSource === "queue"}
        compact
      />
    </div>
  );
}
