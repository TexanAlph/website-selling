"use client";

import { useState } from "react";
import type { InsightsPayload } from "@/hooks/useInsights";
import { DailyInsightsStrip } from "./DailyInsightsStrip";

type Props = {
  insights: InsightsPayload | null;
  insightsLoading: boolean;
  queueError: string | null;
  onRetryQueue: () => void;
};

export function LeadsMorePanel({
  insights,
  insightsLoading,
  queueError,
  onRetryQueue,
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
        <span>Daily tip &amp; scraper</span>
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
        </div>
      ) : null}
    </section>
  );
}
