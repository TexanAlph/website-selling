"use client";

import type { InsightsPayload, DailyInsightContent } from "@/hooks/useInsights";

type Props = {
  data: InsightsPayload | null;
  loading: boolean;
  compact?: boolean;
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

function scraperLine(
  scraper: InsightsPayload["lastScraperRun"] | undefined,
): string {
  if (!scraper) return "No scraper runs logged yet";
  if (scraper.status === "ok") {
    return `Last refill +${scraper.leads_upserted} leads · ${formatScraperAge(scraper.finished_at ?? scraper.started_at)}`;
  }
  if (scraper.status === "error") {
    return "Scraper issue — check Mac Mini";
  }
  return "Scraper running…";
}

export function DailyInsightsStrip({ data, loading, compact = false }: Props) {
  const content = data?.dailyInsight?.content as DailyInsightContent | undefined;
  const scraper = data?.lastScraperRun;

  if (compact) {
    const tip =
      loading && !content?.headline
        ? "Loading tip…"
        : content?.headline ??
          "Daily tip appears after tonight's analysis.";
    return (
      <p className="insights-inline" aria-live="polite">
        <span className="insights-inline__tip">{tip}</span>
        <span className="insights-inline__sep" aria-hidden>
          {" "}
          ·{" "}
        </span>
        <span className="insights-inline__meta">{scraperLine(scraper)}</span>
      </p>
    );
  }

  return (
    <section className="insights-strip">
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
          Daily tip shows up after tonight&apos;s analysis run.
        </p>
      )}

      <p className="insights-strip-scraper">
        {scraper ? (
          scraper.status === "ok" ? (
            <>
              Last refill{" "}
              <span className="insights-status-ok">
                +{scraper.leads_upserted} leads
              </span>{" "}
              · {formatScraperAge(scraper.finished_at ?? scraper.started_at)}
            </>
          ) : scraper.status === "error" ? (
            <span className="insights-status-err">Scraper issue — check Mini</span>
          ) : (
            <>Scraper running…</>
          )
        ) : (
          <span className="insights-strip-muted">No scraper runs logged yet</span>
        )}
      </p>
    </section>
  );
}
