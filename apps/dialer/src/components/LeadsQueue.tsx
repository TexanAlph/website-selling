"use client";

import type { Lead } from "@/lib/leads";
import type { SessionRecap } from "@/lib/calls/types";
import type { InsightsPayload } from "@/hooks/useInsights";
import { LeadCard } from "./LeadCard";
import { CoachPanel } from "./CoachPanel";
import { PostCallRecap } from "./PostCallRecap";
import { DailyInsightsStrip } from "./DailyInsightsStrip";
import { ScraperStatusStrip } from "./ScraperStatusStrip";
import { MAX_NEW_PER_REP, queueLabel } from "@/lib/rep-queue";

type Props = {
  lead: Lead | null;
  queueCount: number | null;
  loading: boolean;
  calling: boolean;
  deviceReady: boolean;
  testMode: boolean;
  sessionId: string | null;
  error: string | null;
  recap: SessionRecap | null;
  recapLoading: boolean;
  insights: InsightsPayload | null;
  insightsLoading: boolean;
  onDismissRecap: () => void;
  onRetryQueue: () => void;
  onCallLead: () => void;
  onOutcome: (key: "wrong" | "not_interested" | "interested") => void;
};

export function LeadsQueue({
  lead,
  queueCount,
  loading,
  calling,
  deviceReady,
  testMode,
  sessionId,
  error,
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

  const atCap = queueCount !== null && queueCount >= MAX_NEW_PER_REP;
  const countLabel =
    queueCount === null
      ? "…"
      : `Your queue: ${queueLabel(queueCount)}`;

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

        {error && !insights ? (
          <p className="alert-error leads-error">{error}</p>
        ) : null}
      </div>

      {calling && (
        <div className="leads-main">
          <div className="leads-coach-pane">
            <CoachPanel
              sessionId={sessionId}
              leadId={lead?.id ?? null}
              nicheLabel={nicheLabel}
              active={calling}
            />
          </div>
        </div>
      )}
    </div>
  );
}
