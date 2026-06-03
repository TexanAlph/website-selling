"use client";

import { useState } from "react";
import type { Lead } from "@/lib/leads";
import type { InsightsPayload } from "@/hooks/useInsights";
import { DailyInsightsStrip } from "./DailyInsightsStrip";
import { RecentLeadsPanel } from "./RecentLeadsPanel";

type Props = {
  testMode: boolean;
  insights: InsightsPayload | null;
  insightsLoading: boolean;
  queueError: string | null;
  onRetryQueue: () => void;
  onSelectRecentLead: (lead: Lead) => void;
};

export function LeadsMorePanel({
  testMode,
  insights,
  insightsLoading,
  queueError,
  onRetryQueue,
  onSelectRecentLead,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="leads-more glass">
      <button
        type="button"
        className="leads-more-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Stats &amp; history</span>
        <span className="leads-more-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>

      {open ? (
        <div className="leads-more-body animate-fade-in">
          <DailyInsightsStrip
            data={insights}
            loading={insightsLoading}
            queueError={queueError}
            onRetryQueue={onRetryQueue}
          />
          <RecentLeadsPanel
            testMode={testMode}
            onSelectLead={onSelectRecentLead}
            embedded
          />
        </div>
      ) : null}
    </section>
  );
}
