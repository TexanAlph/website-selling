"use client";

import { useEffect, useRef, useState } from "react";
import { useCoachListening } from "@/hooks/useCoachListening";
import { parseCounterDisplay, sanitizeSayNow } from "@/lib/coach/coach-display";
import { stageLabel, type CallStage } from "@/lib/coach/call-stage";

type CoachMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

type Props = {
  sessionId: string | null;
  leadId: string | null;
  nicheLabel?: string | null;
  active: boolean;
  testMode?: boolean;
  /** Full-screen in-call layout (iPhone-style). */
  variant?: "default" | "phone";
};

export function CoachPanel({
  sessionId,
  leadId,
  nicheLabel,
  active,
  testMode = false,
  variant = "default",
}: Props) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(
    null,
  );
  const lastCounterAtRef = useRef<string | null>(null);

  const { listening, sayNow, streaming, coachError, companyName, nextHints } =
    useCoachListening(sessionId, leadId, active);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setFeedbackSent(null);
      setFeedbackMessageId(null);
      lastCounterAtRef.current = null;
      return;
    }

    if (testMode) return;

    let cancelled = false;

    const poll = async () => {
      const since = lastCounterAtRef.current ?? undefined;
      const q = new URLSearchParams({ sessionId });
      if (since) q.set("since", since);
      try {
        const res = await fetch(`/api/coach/counters?${q}`);
        if (!res.ok || cancelled) return;
        const json = (await res.json()) as { messages?: CoachMessage[] };
        for (const row of json.messages ?? []) {
          if (row.role !== "counter") continue;
          lastCounterAtRef.current = row.created_at;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [...prev, row];
          });
          setFeedbackMessageId(row.id);
          setFeedbackSent(null);
        }
      } catch {
        /* ignore */
      }
    };

    void poll();
    const id = window.setInterval(() => void poll(), 1500);

    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [sessionId, testMode]);

  const counters = messages.filter((m) => m.role === "counter");
  const latestCounter = counters[counters.length - 1];
  const latestParsed = latestCounter
    ? parseCounterDisplay(latestCounter.content)
    : null;
  const stageBadge =
    latestParsed?.stage &&
    [
      "opening",
      "gatekeeper",
      "discovery",
      "pitch",
      "objection",
      "closing",
      "wrap",
    ].includes(latestParsed.stage)
      ? stageLabel(latestParsed.stage as CallStage)
      : null;

  const displaySayNow = sanitizeSayNow(
    sayNow ||
      (latestParsed?.text && !streaming ? latestParsed.text : "") ||
      "",
  );

  const contextLine = [companyName, nicheLabel?.trim()]
    .filter(Boolean)
    .join(" · ");

  async function sendFeedback(helpful: boolean) {
    const msgId = feedbackMessageId ?? latestCounter?.id;
    if (!sessionId || !msgId) return;
    setFeedbackSent(msgId);
    await fetch("/api/coach/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        messageId: msgId,
        helpful,
      }),
    });
  }

  if (variant === "phone") {
    return (
      <section
        className="coach-panel-phone"
        aria-label="AI coach"
      >
        <div className="coach-panel-phone__meta">
          {stageBadge ? (
            <span className="coach-stage-pill">{stageBadge}</span>
          ) : null}
          {active && listening ? (
            <span className="coach-listening-pill" aria-live="polite">
              <span className="coach-listening-dot" />
              Listening
            </span>
          ) : null}
        </div>
        <p className="coach-panel-phone__label">
          Say now{streaming ? "…" : ""}
        </p>
        <p className="coach-panel-phone__script">
          {displaySayNow ||
            (streaming
              ? "…"
              : "Opening line appears when the call connects.")}
        </p>
        {coachError ? (
          <p className="coach-panel-phone__error" role="alert">
            {coachError}
          </p>
        ) : null}
        {active && !streaming && nextHints.length ? (
          <div className="mt-2 space-y-1">
            {nextHints.map((h) => (
              <p
                key={h.label}
                className="text-[11px] leading-snug text-[var(--text-tertiary)]"
              >
                <span className="font-semibold text-[var(--text-secondary)]">
                  If &ldquo;{h.label}&rdquo;:
                </span>{" "}
                {h.line}
              </p>
            ))}
          </div>
        ) : null}
        {contextLine ? (
          <p className="coach-panel-phone__context">{contextLine}</p>
        ) : null}
        {active && (feedbackMessageId ?? latestCounter) && feedbackSent !== (feedbackMessageId ?? latestCounter?.id) ? (
          <div className="coach-feedback-row coach-feedback-row--center">
            <span className="text-[10px] text-[var(--text-tertiary)]">
              Helpful?
            </span>
            <button
              type="button"
              className="coach-feedback-btn"
              onClick={() => void sendFeedback(true)}
            >
              Yes
            </button>
            <button
              type="button"
              className="coach-feedback-btn"
              onClick={() => void sendFeedback(false)}
            >
              No
            </button>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <section className="glass coach-panel flex min-h-0 flex-1 flex-col rounded-[var(--radius-xl)] p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
            AI coach
          </h2>
          {contextLine ? (
            <p className="mt-0.5 text-[11px] text-[var(--text-secondary)]">
              {contextLine}
            </p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          {stageBadge ? (
            <span className="coach-stage-pill">{stageBadge}</span>
          ) : null}
          {active && listening ? (
            <span className="coach-listening-pill" aria-live="polite">
              <span className="coach-listening-dot" />
              Listening
            </span>
          ) : null}
        </div>
      </div>

      {active ? (
        <div className="coach-say-now coach-say-now--hero mt-3 flex min-h-0 flex-1 flex-col rounded-[var(--radius-lg)] border border-emerald-500/25 bg-emerald-950/40 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-400/90">
            Say now
            {streaming ? " · …" : ""}
          </p>
          <p className="coach-say-now__body mt-2 flex-1 text-base leading-relaxed text-[var(--text)]">
            {displaySayNow ||
              (streaming
                ? "…"
                : "Your opening line appears here when the call connects.")}
          </p>
          {coachError ? (
            <p className="mt-2 text-[11px] text-red-300/90" role="alert">
              {coachError}
            </p>
          ) : null}
          {!streaming && nextHints.length ? (
            <div className="mt-3 space-y-1 border-t border-emerald-500/15 pt-2">
              {nextHints.map((h) => (
                <p
                  key={h.label}
                  className="text-[11px] leading-snug text-[var(--text-tertiary)]"
                >
                  <span className="font-semibold text-emerald-400/80">
                    If &ldquo;{h.label}&rdquo;:
                  </span>{" "}
                  {h.line}
                </p>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-[10px] text-[var(--text-tertiary)]">
            Updates when they speak — no transcript panel, just what to say.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--text-secondary)]">
          Start a call to activate the coach.
        </p>
      )}

      {active && (feedbackMessageId ?? latestCounter) && feedbackSent !== (feedbackMessageId ?? latestCounter?.id) ? (
        <div className="coach-feedback-row">
          <span className="text-[10px] text-[var(--text-tertiary)]">
            Helpful?
          </span>
          <button
            type="button"
            className="coach-feedback-btn"
            onClick={() => void sendFeedback(true)}
          >
            Yes
          </button>
          <button
            type="button"
            className="coach-feedback-btn"
            onClick={() => void sendFeedback(false)}
          >
            No
          </button>
        </div>
      ) : null}
    </section>
  );
}
