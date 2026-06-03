"use client";

import type { Lead } from "@/lib/leads";
import type { SessionRecap } from "@/lib/calls/types";
import { LeadCard } from "./LeadCard";
import { PostCallRecap } from "./PostCallRecap";

type Props = {
  lead: Lead | null;
  recap: SessionRecap | null;
  recapLoading: boolean;
  loading: boolean;
  onDismissRecap: () => void;
  onOutcome: (key: "wrong" | "not_interested" | "interested") => void;
};

export function PostCallWrapUp({
  lead,
  recap,
  recapLoading,
  loading,
  onDismissRecap,
  onOutcome,
}: Props) {
  return (
    <section className="wrap-up-screen glass animate-wrap-up" aria-live="polite">
      <header className="wrap-up-screen__header">
        <h2 className="wrap-up-screen__title">Wrap up</h2>
        <p className="wrap-up-screen__subtitle">
          Log how the call went — then you&apos;ll get the next lead.
        </p>
      </header>

      <LeadCard lead={lead} loading={loading && !lead} variant="compact" />

      {(recap || recapLoading) && (
        <PostCallRecap
          recap={recap}
          loading={recapLoading}
          onDismiss={onDismissRecap}
          embedded
        />
      )}

      <div className="wrap-up-screen__outcomes">
        <p className="wrap-up-screen__outcomes-label">Outcome</p>
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
    </section>
  );
}
