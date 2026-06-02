"use client";

import { useCallback, useEffect, useState } from "react";

export type DailyInsightContent = {
  headline?: string;
  wins_vs_losses?: string;
  top_objections?: string[];
  script_tweaks?: string[];
  focus_niche?: string;
};

export type InsightsPayload = {
  dailyInsight: {
    report_date: string;
    content: DailyInsightContent | Record<string, unknown>;
    created_at: string;
  } | null;
  lastScraperRun: {
    started_at: string;
    finished_at: string | null;
    status: string;
    leads_upserted: number;
    error_message: string | null;
  } | null;
};

export function useInsights(active: boolean) {
  const [data, setData] = useState<InsightsPayload | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/insights");
      if (res.ok) {
        setData((await res.json()) as InsightsPayload);
      }
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!active) return;
    void refresh();
  }, [active, refresh]);

  return { data, loading, refresh };
}
