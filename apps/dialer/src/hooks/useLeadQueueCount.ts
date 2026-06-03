"use client";

import { useCallback, useEffect, useState } from "react";
import { isTestDialerMode } from "@/lib/test-dialer";

const POLL_MS = 15_000;

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

    const pollId = window.setInterval(() => {
      void refreshQueueCount();
    }, POLL_MS);

    return () => {
      window.clearInterval(pollId);
    };
  }, [active, refreshQueueCount, testMode]);

  return { queueCount, refreshQueueCount, setQueueCount };
}
