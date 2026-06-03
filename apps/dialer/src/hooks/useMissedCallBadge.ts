"use client";

import { useEffect } from "react";
import { useMissedUnreadCount } from "./useMissedUnreadCount";

/** Poll missed-call count and set PWA app icon badge when supported. */
export function useMissedCallBadge(testMode: boolean) {
  const { unread } = useMissedUnreadCount(testMode);

  useEffect(() => {
    const nav = navigator as Navigator & {
      setAppBadge?: (n: number) => Promise<void>;
      clearAppBadge?: () => Promise<void>;
    };
    if (testMode) {
      void nav.clearAppBadge?.().catch(() => {});
      return;
    }
    if (unread > 0) {
      void nav.setAppBadge?.(unread).catch(() => {});
    } else {
      void nav.clearAppBadge?.().catch(() => {});
    }
  }, [testMode, unread]);
}
