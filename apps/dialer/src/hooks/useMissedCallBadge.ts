"use client";

import { useCallback, useEffect } from "react";

/** Poll missed-call count and set PWA app icon badge when supported. */
export function useMissedCallBadge(testMode: boolean) {
  const refresh = useCallback(async () => {
    if (testMode) {
      try {
        await (
          navigator as Navigator & { clearAppBadge?: () => Promise<void> }
        ).clearAppBadge?.();
      } catch {
        /* ignore */
      }
      return;
    }
    try {
      const res = await fetch("/api/calls/missed");
      if (!res.ok) return;
      const json = (await res.json()) as {
        calls?: { listened_at: string | null }[];
      };
      const unread = (json.calls ?? []).filter((c) => !c.listened_at).length;
      const nav = navigator as Navigator & {
        setAppBadge?: (n: number) => Promise<void>;
        clearAppBadge?: () => Promise<void>;
      };
      if (unread > 0) {
        await nav.setAppBadge?.(unread);
      } else {
        await nav.clearAppBadge?.();
      }
    } catch {
      /* ignore */
    }
  }, [testMode]);

  useEffect(() => {
    void refresh();
    const id = window.setInterval(() => void refresh(), 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [refresh]);
}
