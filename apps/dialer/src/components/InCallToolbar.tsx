"use client";

import type { CallPhase } from "@/hooks/usePhoneCall";
import type { Lead } from "@/lib/leads";
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
  onEndCall: () => void;
  onToggleMute: () => void;
  keypadCoachThisCall: boolean;
  onKeypadCoachThisCallChange: (on: boolean) => void;
};

export function InCallToolbar({
  callSource,
  callPhase,
  callStatusLabel,
  muted,
  testMode,
  lead,
  dialDisplay,
  onEndCall,
  onToggleMute,
  keypadCoachThisCall,
  onKeypadCoachThisCallChange,
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
          {lead.niche?.trim() ? ` · ${lead.niche.trim()}` : ""}
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
        muted={muted}
        testMode={testMode}
        onToggleMute={onToggleMute}
      />
      <KeypadCoachToggle
        mode="thisCall"
        leadCallActive={callSource === "queue"}
        thisCallOn={keypadCoachThisCall}
        onThisCallChange={onKeypadCoachThisCallChange}
        compact
      />
    </div>
  );
}
