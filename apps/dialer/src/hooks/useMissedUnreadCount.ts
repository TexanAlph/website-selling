"use client";

import { useCallback, useEffect, useState } from "react";
import type { MissedCall } from "@/lib/calls/inbound";
import { isMissedUnread } from "@/lib/calls/inbound";

export function useMissedUnreadCount(testMode: boolean) {
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    if (testMode) {
      setUnread(0);
      return;
    }
    try {
      const res = await fetch("/api/calls/missed");
      if (!res.ok) {
        setUnread(0);
        return;
      }
      const json = (await res.json()) as { calls?: MissedCall[] };
      setUnread((json.calls ?? []).filter(isMissedUnread).length);
    } catch {
      setUnread(0);
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

  return { unread, refresh };
}
