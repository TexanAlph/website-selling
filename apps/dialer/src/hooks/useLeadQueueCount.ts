"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isTestDialerMode } from "@/lib/test-dialer";

const POLL_MS = 60_000;

export function useLeadQueueCount(active: boolean) {
  const testMode = isTestDialerMode();
  const [queueCount, setQueueCount] = useState<number | null>(null);

  const refreshQueueCount = useCallback(async () => {
    if (testMode) {
      setQueueCount(1);
      return;
    }

    try {
      const res = await fetch("/api/leads/count");
      const json = await res.json();
      if (res.ok && typeof json.queueCount === "number") {
        setQueueCount(json.queueCount);
      }
    } catch {
      /* keep last known count */
    }
  }, [testMode]);

  useEffect(() => {
    if (!active) return;

    void refreshQueueCount();
    if (testMode) return;

    const supabase = createClient();
    const channel = supabase
      .channel("leads-queue-count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads" },
        () => {
          void refreshQueueCount();
        },
      )
      .subscribe();

    const pollId = window.setInterval(() => {
      void refreshQueueCount();
    }, POLL_MS);

    return () => {
      void supabase.removeChannel(channel);
      window.clearInterval(pollId);
    };
  }, [active, refreshQueueCount, testMode]);

  return { queueCount, refreshQueueCount, setQueueCount };
}
