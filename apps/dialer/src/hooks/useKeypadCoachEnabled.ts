"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "dialer-keypad-coach-enabled";

/** Persisted preference: AI coach on Keypad calls (OpenRouter). Default on. */
export function useKeypadCoachEnabled() {
  const [enabled, setEnabledState] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "0") setEnabledState(false);
      else if (v === "1") setEnabledState(true);
    } catch {
      /* private mode */
    }
    setReady(true);
  }, []);

  const setEnabled = useCallback((on: boolean) => {
    setEnabledState(on);
    try {
      localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  return { enabled, setEnabled, ready };
}
