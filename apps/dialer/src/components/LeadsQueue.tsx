"use client";

import type { Lead } from "@/lib/leads";
import { LeadCard } from "./LeadCard";
import { CoachPanel } from "./CoachPanel";

type Props = {
  lead: Lead | null;
  loading: boolean;
  calling: boolean;
  deviceReady: boolean;
  testMode: boolean;
  sessionId: string | null;
  error: string | null;
  onCallLead: () => void;
  onOutcome: (key: "wrong" | "not_interested" | "interested") => void;
};

export function LeadsQueue({
  lead,
  loading,
  calling,
  deviceReady,
  testMode,
  sessionId,
  error,
  onCallLead,
  onOutcome,
}: Props) {
  const canCall = Boolean(lead) && (testMode || deviceReady) && !loading;

  return (
    <div className="leads-shell">
      <div className="leads-top">
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

        {error && <p className="alert-error leads-error">{error}</p>}
      </div>

      {calling && (
        <div className="leads-main">
          <div className="leads-coach-pane">
            <CoachPanel
              sessionId={sessionId}
              leadId={lead?.id ?? null}
              active={calling}
            />
          </div>
        </div>
      )}
    </div>
  );
}
