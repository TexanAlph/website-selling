"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "dialer-keypad-coach-default";

/** Default coach on/off for the *next* keypad call (saved on device). */
export function useKeypadCoachDefault() {
  const [defaultOn, setDefaultOnState] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const v = localStorage.getItem(STORAGE_KEY);
      if (v === "0") setDefaultOnState(false);
      else if (v === "1") setDefaultOnState(true);
    } catch {
      /* private mode */
    }
    setReady(true);
  }, []);

  const setDefaultOn = useCallback((on: boolean) => {
    setDefaultOnState(on);
    try {
      localStorage.setItem(STORAGE_KEY, on ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, []);

  return { defaultOn, setDefaultOn, ready };
}
