"use client";

import type { Lead } from "@/lib/leads";
import type { SessionRecap } from "@/lib/calls/types";
import type { InsightsPayload } from "@/hooks/useInsights";
import { LeadCard } from "./LeadCard";
import { PostCallWrapUp } from "./PostCallWrapUp";
import { DailyInsightsStrip } from "./DailyInsightsStrip";
import { PreCallBrief } from "./PreCallBrief";
import { MAX_NEW_PER_REP, queueCountDisplay } from "@/lib/rep-queue";

type Props = {
  lead: Lead | null;
  queueCount: number | null;
  storageConfigured: boolean;
  loading: boolean;
  deviceReady: boolean;
  testMode: boolean;
  error: string | null;
  /** Shared in-call UI (toolbar + coach) lives in Dialer */
  callInProgress?: boolean;
  recap: SessionRecap | null;
  recapLoading: boolean;
  insights: InsightsPayload | null;
  insightsLoading: boolean;
  onDismissRecap: () => void;
  onRetryQueue: () => void;
  onCallLead: () => void;
  onOutcome: (key: "wrong" | "not_interested" | "interested") => void;
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
  deviceReady,
  testMode,
  error,
  callInProgress = false,
  recap,
  recapLoading,
  insights,
  insightsLoading,
  onDismissRecap,
  onRetryQueue,
  onCallLead,
  onOutcome,
}: Props) {
  const canCall = Boolean(lead) && (testMode || deviceReady) && !loading;
  const needsOutcome =
    Boolean(lead) &&
    lead?.status === "Calling" &&
    !callInProgress &&
    !testMode;
  const wrapUp =
    !callInProgress &&
    (needsOutcome || recapLoading || Boolean(recap?.summary || recap?.repScore));

  const leadKey = lead?.id ?? "empty";

  if (callInProgress) {
    return null;
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

        <DailyInsightsStrip
          data={insights}
          loading={insightsLoading}
          compact
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

        {lead && !loading ? (
          <PreCallBrief niche={lead.niche ?? null} />
        ) : null}

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

        {error ? (
          <div className="leads-error-row">
            <p className="alert-error leads-error">{error}</p>
            <button
              type="button"
              className="btn-ghost text-xs"
              onClick={onRetryQueue}
            >
              Retry
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
