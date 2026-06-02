"use client";

import type { InsightsPayload, DailyInsightContent } from "@/hooks/useInsights";

type Props = {
  data: InsightsPayload | null;
  loading: boolean;
  onRetryQueue?: () => void;
  queueError?: string | null;
};

function formatScraperAge(iso: string | undefined): string {
  if (!iso) return "unknown";
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.floor(diff / 3_600_000);
  if (hours < 1) return "just now";
  if (hours < 48) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function DailyInsightsStrip({
  data,
  loading,
  onRetryQueue,
  queueError,
}: Props) {
  const content = data?.dailyInsight?.content as DailyInsightContent | undefined;
  const scraper = data?.lastScraperRun;

  return (
    <section className="insights-strip glass">
      {queueError && onRetryQueue ? (
        <div className="insights-strip-error">
          <p>{queueError}</p>
          <button type="button" className="btn-ghost text-xs" onClick={onRetryQueue}>
            Retry
          </button>
        </div>
      ) : null}

      {loading && !content?.headline ? (
        <p className="insights-strip-muted">Loading insights…</p>
      ) : content?.headline ? (
        <>
          <p className="insights-strip-headline">{content.headline}</p>
          {content.focus_niche ? (
            <p className="insights-strip-muted">{content.focus_niche}</p>
          ) : null}
        </>
      ) : (
        <p className="insights-strip-muted">
          Daily insights appear after the nightly analysis job runs.
        </p>
      )}

      <p className="insights-strip-scraper">
        Scraper:{" "}
        {scraper ? (
          <>
            <span
              className={
                scraper.status === "ok"
                  ? "insights-status-ok"
                  : scraper.status === "error"
                    ? "insights-status-err"
                    : ""
              }
            >
              {scraper.status}
            </span>
            {scraper.status === "ok"
              ? ` · +${scraper.leads_upserted} leads · ${formatScraperAge(scraper.finished_at ?? scraper.started_at)}`
              : ` · ${formatScraperAge(scraper.started_at)}`}
          </>
        ) : (
          "no runs logged yet — run migration 006 + scraper"
        )}
      </p>
    </section>
  );
}
