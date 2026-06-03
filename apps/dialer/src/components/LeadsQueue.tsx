"use client";

import type { CallPhase } from "@/hooks/usePhoneCall";
import type { Lead } from "@/lib/leads";
import { CallControlsBar } from "./CallControlsBar";
import type { SessionRecap } from "@/lib/calls/types";
import type { InsightsPayload } from "@/hooks/useInsights";
import { LeadCard } from "./LeadCard";
import { CoachPanel } from "./CoachPanel";
import { PostCallWrapUp } from "./PostCallWrapUp";
import { LeadsMorePanel } from "./LeadsMorePanel";
import { CallHistoryPanel } from "./CallHistoryPanel";
import { MAX_NEW_PER_REP, queueCountDisplay } from "@/lib/rep-queue";

type Props = {
  lead: Lead | null;
  queueCount: number | null;
  storageConfigured: boolean;
  loading: boolean;
  calling: boolean;
  callPhase: CallPhase;
  callStatusLabel: string;
  deviceReady: boolean;
  testMode: boolean;
  speakerOn: boolean;
  speakerSupported: boolean;
  muted: boolean;
  sessionId: string | null;
  error: string | null;
  onToggleSpeaker: () => void;
  onToggleMute: () => void;
  recap: SessionRecap | null;
  recapLoading: boolean;
  insights: InsightsPayload | null;
  insightsLoading: boolean;
  onDismissRecap: () => void;
  onRetryQueue: () => void;
  onCallLead: () => void;
  onOutcome: (key: "wrong" | "not_interested" | "interested") => void;
  onSelectRecentLead: (lead: Lead) => void;
  onCallBack: (phone: string) => void;
};

function QueueHero({
  queueCount,
  testMode,
  storageConfigured,
}: {
  queueCount: number | null;
  testMode: boolean;
  storageConfigured: boolean;
}) {
  const { primary, secondary } = queueCountDisplay(queueCount, {
    testMode,
    storageConfigured,
  });
  return (
    <div className="leads-queue-hero" aria-live="polite">
      <p className="leads-queue-hero__primary">{primary}</p>
      {secondary ? (
        <p className="leads-queue-hero__secondary">{secondary}</p>
      ) : null}
    </div>
  );
}

export function LeadsQueue({
  lead,
  queueCount,
  storageConfigured,
  loading,
  calling,
  callPhase,
  callStatusLabel,
  deviceReady,
  testMode,
  speakerOn,
  speakerSupported,
  muted,
  sessionId,
  error,
  onToggleSpeaker,
  onToggleMute,
  recap,
  recapLoading,
  insights,
  insightsLoading,
  onDismissRecap,
  onRetryQueue,
  onCallLead,
  onOutcome,
  onSelectRecentLead,
  onCallBack,
}: Props) {
  const canCall = Boolean(lead) && (testMode || deviceReady) && !loading;
  const needsOutcome =
    Boolean(lead) && lead?.status === "Calling" && !calling && !testMode;
  const wrapUp =
    !calling &&
    (needsOutcome || recapLoading || Boolean(recap?.summary || recap?.repScore));

  const nicheLabel = lead?.niche?.trim() || null;
  const leadKey = lead?.id ?? "empty";

  if (calling) {
    return (
      <div className="leads-shell leads-shell--on-call">
        <div className="leads-top leads-top--minimal">
          <LeadCard
            lead={lead}
            loading={loading && !lead}
            calling
            variant="strip"
          />
          <div className="leads-actions leads-actions--compact">
            <button
              type="button"
              onClick={onCallLead}
              className="btn-primary leads-call-btn btn-primary--end"
            >
              End call
            </button>
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
          </div>
        </div>
        <div className="leads-main">
          <div className="leads-coach-pane">
            <CoachPanel
              sessionId={sessionId}
              leadId={lead?.id ?? null}
              nicheLabel={nicheLabel}
              active={calling}
              testMode={testMode}
            />
          </div>
        </div>
      </div>
    );
  }

  if (wrapUp) {
    return (
      <div className="leads-shell leads-shell--wrap-up">
        <QueueHero
          queueCount={queueCount}
          testMode={testMode}
          storageConfigured={storageConfigured}
        />
        <PostCallWrapUp
          lead={lead}
          recap={recap}
          recapLoading={recapLoading}
          loading={loading}
          onDismissRecap={onDismissRecap}
          onOutcome={onOutcome}
        />
        {error ? <p className="alert-error leads-error">{error}</p> : null}
      </div>
    );
  }

  return (
    <div className="leads-shell leads-shell--idle">
      <div className="leads-top">
        <QueueHero
          queueCount={queueCount}
          testMode={testMode}
          storageConfigured={storageConfigured}
        />

        {!lead && !loading && queueCount === 0 && !testMode ? (
          <p className="leads-hint">
            No leads right now — scraper refills when you&apos;re below{" "}
            {MAX_NEW_PER_REP}.
          </p>
        ) : null}

        <div key={leadKey} className="lead-card-slot animate-lead-in">
          <LeadCard lead={lead} loading={loading && !lead} variant="compact" />
        </div>

        <div className="leads-actions">
          <button
            type="button"
            disabled={!canCall}
            onClick={onCallLead}
            className="btn-primary leads-call-btn"
          >
            {testMode
              ? "Call this lead"
              : deviceReady
                ? "Call this lead"
                : "Connecting phone…"}
          </button>

          <div className="leads-outcomes">
            <button
              type="button"
              disabled={!lead || loading}
              onClick={() => onOutcome("wrong")}
              className="outcome-btn outcome-btn--danger"
            >
              Wrong
              <span>number</span>
            </button>
            <button
              type="button"
              disabled={!lead || loading}
              onClick={() => onOutcome("not_interested")}
              className="outcome-btn outcome-btn--warn"
            >
              Not
              <span>interested</span>
            </button>
            <button
              type="button"
              disabled={!lead || loading}
              onClick={() => onOutcome("interested")}
              className="outcome-btn outcome-btn--accent"
            >
              Interested
              <span>closed</span>
            </button>
          </div>
        </div>

        {error ? <p className="alert-error leads-error">{error}</p> : null}

        <CallHistoryPanel
          testMode={testMode}
          onSelectLead={onSelectRecentLead}
          onCallBack={onCallBack}
        />

        <LeadsMorePanel
          insights={insights}
          insightsLoading={insightsLoading}
          queueError={error}
          onRetryQueue={onRetryQueue}
        />
      </div>
    </div>
  );
}
