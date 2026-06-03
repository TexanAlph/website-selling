"use client";

import type { CallPhase } from "@/hooks/usePhoneCall";
import type { Lead } from "@/lib/leads";
import { CallStatusBar } from "./CallStatusBar";
import type { SessionRecap } from "@/lib/calls/types";
import type { InsightsPayload } from "@/hooks/useInsights";
import { LeadCard } from "./LeadCard";
import { CoachPanel } from "./CoachPanel";
import { PostCallRecap } from "./PostCallRecap";
import { DailyInsightsStrip } from "./DailyInsightsStrip";
import { ScraperStatusStrip } from "./ScraperStatusStrip";
import { MAX_NEW_PER_REP, queueCountDisplay } from "@/lib/rep-queue";
import { RecentLeadsPanel } from "./RecentLeadsPanel";

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
  sessionId: string | null;
  error: string | null;
  onToggleSpeaker: () => void;
  recap: SessionRecap | null;
  recapLoading: boolean;
  insights: InsightsPayload | null;
  insightsLoading: boolean;
  onDismissRecap: () => void;
  onRetryQueue: () => void;
  onCallLead: () => void;
  onOutcome: (key: "wrong" | "not_interested" | "interested") => void;
  onSelectRecentLead: (lead: Lead) => void;
};

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
  sessionId,
  error,
  onToggleSpeaker,
  recap,
  recapLoading,
  insights,
  insightsLoading,
  onDismissRecap,
  onRetryQueue,
  onCallLead,
  onOutcome,
  onSelectRecentLead,
}: Props) {
  const canCall = Boolean(lead) && (testMode || deviceReady) && !loading;
  const needsOutcome =
    Boolean(lead) && lead?.status === "Calling" && !calling && !testMode;

  const atCap =
    !testMode && queueCount !== null && queueCount >= MAX_NEW_PER_REP;
  const countLabel = queueCountDisplay(queueCount, {
    testMode,
    storageConfigured,
  });

  const nicheLabel = lead?.niche?.trim() || null;

  return (
    <div className="leads-shell">
      <div className="leads-top">
        <DailyInsightsStrip
          data={insights}
          loading={insightsLoading}
          queueError={error}
          onRetryQueue={onRetryQueue}
        />

        <p className="leads-queue-count" aria-live="polite">
          <span className="leads-queue-count-value">{countLabel}</span>
        </p>
        <ScraperStatusStrip />
        {atCap && !calling ? (
          <p className="text-[11px] text-[var(--text-secondary)]">
            Queue full — Mac Mini will skip Google until you clear outcomes.
          </p>
        ) : null}
        {!lead && !loading && queueCount === 0 ? (
          <p className="text-[11px] text-[var(--text-secondary)]">
            No leads in your queue. Scraper refills when below {MAX_NEW_PER_REP}.
          </p>
        ) : null}

        {needsOutcome ? (
          <p className="wrap-up-banner" role="status">
            Call ended — tap Wrong, Not interested, or Interested to save and
            load the next lead. AI recap is below (not a substitute for
            outcome).
          </p>
        ) : null}

        {!calling && (recap || recapLoading) ? (
          <PostCallRecap
            recap={recap}
            loading={recapLoading}
            onDismiss={onDismissRecap}
          />
        ) : null}

        {calling ? (
          <LeadCard
            lead={lead}
            loading={loading && !lead}
            calling
            variant="strip"
          />
        ) : (
          <LeadCard lead={lead} loading={loading && !lead} variant="compact" />
        )}

        <div className="leads-actions">
          <button
            type="button"
            disabled={!canCall && !calling}
            onClick={onCallLead}
            className={`btn-primary leads-call-btn ${calling ? "btn-primary--end" : ""}`}
          >
            {calling
              ? "End call"
              : testMode
                ? "Call this lead"
                : deviceReady
                  ? "Call this lead"
                  : "Connecting phone…"}
          </button>

          {calling ? (
            <CallStatusBar
              callPhase={callPhase}
              callStatusLabel={callStatusLabel}
              speakerOn={speakerOn}
              speakerSupported={speakerSupported}
              testMode={testMode}
              onToggleSpeaker={onToggleSpeaker}
            />
          ) : null}

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

        {error && !insights ? (
          <p className="alert-error leads-error">{error}</p>
        ) : null}

        <RecentLeadsPanel
          testMode={testMode}
          onSelectLead={onSelectRecentLead}
        />
      </div>

      {calling && (
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
      )}
    </div>
  );
}
