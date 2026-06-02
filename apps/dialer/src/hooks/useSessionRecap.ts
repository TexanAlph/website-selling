"use client";

import { useCallback, useEffect, useState } from "react";
import type { SessionRecap } from "@/lib/calls/types";

const POLL_MS = 2000;
const MAX_POLLS = 20;

export function useSessionRecap(sessionId: string | null) {
  const [recap, setRecap] = useState<SessionRecap | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchRecap = useCallback(async () => {
    if (!sessionId) return null;
    const res = await fetch(`/api/calls/session/${sessionId}`);
    if (!res.ok) return null;
    const json = await res.json();
    return (json.recap as SessionRecap) ?? null;
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) {
      setRecap(null);
      return;
    }

    let cancelled = false;
    let polls = 0;

    setLoading(true);
    setRecap(null);

    const tick = async () => {
      const data = await fetchRecap();
      if (cancelled) return;
      if (data) setRecap(data);

      const done =
        data?.analysisStatus === "completed" ||
        data?.analysisStatus === "failed" ||
        data?.analysisStatus === "skipped";

      if (done || polls >= MAX_POLLS) {
        setLoading(false);
        return;
      }

      polls += 1;
      window.setTimeout(() => void tick(), POLL_MS);
    };

    void tick();

    return () => {
      cancelled = true;
    };
  }, [sessionId, fetchRecap]);

  return { recap, loading };
}
