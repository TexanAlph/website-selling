"use client";

import { useEffect, useRef, useState } from "react";
import { useCoachListening } from "@/hooks/useCoachListening";
import { isTestDialerMode } from "@/lib/test-dialer";
import { parseCounterDisplay } from "@/lib/coach/coach-display";
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
};

export function CoachPanel({ sessionId, leadId, nicheLabel, active }: Props) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [feedbackSent, setFeedbackSent] = useState<string | null>(null);
  const [feedbackMessageId, setFeedbackMessageId] = useState<string | null>(
    null,
  );
  const feedRef = useRef<HTMLDivElement>(null);

  const {
    stack,
    listening,
    liveTranscript,
    isInterim,
    sayNow,
    streaming,
    labeledLines,
    usesMediaLegs,
  } = useCoachListening(sessionId, leadId, active);

  const lastCounterAtRef = useRef<string | null>(null);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      setFeedbackSent(null);
      setFeedbackMessageId(null);
      lastCounterAtRef.current = null;
      return;
    }

    if (isTestDialerMode()) return;

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
  }, [sessionId]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [labeledLines, liveTranscript]);

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

  const displaySayNow =
    sayNow ||
    (latestParsed?.text && !streaming ? latestParsed.text : "");

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

  return (
    <section className="glass flex min-h-0 flex-1 flex-col rounded-[var(--radius-xl)] p-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
            AI coach
          </h2>
          {nicheLabel ? (
            <p className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
              {nicheLabel}
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
          {stack ? (
            <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
              {stack.labels.stt}
            </span>
          ) : null}
        </div>
      </div>

      {active ? (
        <>
          <div
            ref={feedRef}
            className="coach-live-feed mt-3 max-h-[28vh] overflow-y-auto rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)]/60 p-3 text-sm"
            aria-live="polite"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
              On the call
              {usesMediaLegs ? " · prospect / you" : " · mic"}
            </p>
            {labeledLines.length > 0 ? (
              <ul className="mt-2 space-y-2">
                {labeledLines.map((line, i) => (
                  <li
                    key={`${i}-${line.text.slice(0, 24)}`}
                    className={
                      line.speaker === "prospect"
                        ? "coach-line-prospect"
                        : line.speaker === "rep"
                          ? "coach-line-rep"
                          : "coach-line-mixed"
                    }
                  >
                    {line.speaker !== "mixed" ? (
                      <span className="coach-speaker-tag">
                        {line.speaker === "prospect" ? "Prospect" : "You"}
                      </span>
                    ) : null}
                    <span className={line.interim ? "opacity-60" : ""}>
                      {line.text}
                    </span>
                  </li>
                ))}
              </ul>
            ) : liveTranscript ? (
              <p className={`mt-2 ${isInterim ? "opacity-60" : ""}`}>
                {liveTranscript}
              </p>
            ) : (
              <p className="mt-2 text-[var(--text-secondary)]">
                Waiting for speech…
              </p>
            )}
          </div>

          <div className="coach-say-now mt-3 rounded-[var(--radius-lg)] border border-emerald-500/25 bg-emerald-950/40 p-3.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-400/90">
              Say now
              {streaming ? " · …" : ""}
            </p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text)]">
              {displaySayNow ||
                (streaming
                  ? "…"
                  : "Lines appear here as the call progresses.")}
            </p>
          </div>
        </>
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
