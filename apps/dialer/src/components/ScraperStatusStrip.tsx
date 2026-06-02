"use client";

import { useEffect, useState } from "react";

type ScraperRun = {
  status: string;
  finished_at: string | null;
  leads_upserted: number | null;
  estimated_usd: number | null;
};

export function ScraperStatusStrip() {
  const [run, setRun] = useState<ScraperRun | null>(null);

  useEffect(() => {
    void fetch("/api/scraper/status")
      .then((r) => r.json())
      .then((json) => {
        if (json.run) setRun(json.run as ScraperRun);
      })
      .catch(() => {});
  }, []);

  if (!run?.finished_at && run?.status !== "running") return null;

  const label =
    run.status === "skipped"
      ? "Scraper paused — both queues full (no Google API used)"
      : run.status === "ok"
        ? `Last scrape: +${run.leads_upserted ?? 0} leads${run.estimated_usd != null ? ` · ~$${run.estimated_usd}` : ""}`
        : run.status === "error"
          ? "Scraper error — check Mac Mini logs"
          : "Scraper running…";

  return (
    <p className="scraper-status-strip text-[10px] text-[var(--text-tertiary)]">
      {label}
    </p>
  );
}
