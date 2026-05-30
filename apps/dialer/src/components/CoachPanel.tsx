"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useCoachListening } from "@/hooks/useCoachListening";

type CoachMessage = {
  id: string;
  role: string;
  content: string;
  created_at: string;
};

type Props = {
  sessionId: string | null;
  leadId: string | null;
  active: boolean;
};

export function CoachPanel({ sessionId, leadId, active }: Props) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stack = useCoachListening(sessionId, leadId, active);

  useEffect(() => {
    if (!sessionId) {
      setMessages([]);
      return;
    }

    const supabase = createClient();
    const channel = supabase
      .channel(`coach:${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "coach_messages",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as CoachMessage;
          setMessages((prev) => [...prev, row]);
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [sessionId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const counters = messages.filter((m) => m.role === "counter");

  return (
    <section className="glass flex min-h-0 flex-1 flex-col rounded-[var(--radius-xl)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-[var(--text-tertiary)]">
          AI coach
        </h2>
        {stack && (
          <span className="rounded-full border border-[var(--border)] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-medium text-[var(--text-tertiary)]">
            {stack.labels.stt}
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        className="mt-3 flex-1 space-y-3 overflow-y-auto text-sm leading-relaxed"
      >
        {counters.length === 0 ? (
          <p className="text-[var(--text-secondary)]">
            {active
              ? "Listening… counter-objections appear here in real time."
              : "Start a call to activate the coach."}
          </p>
        ) : (
          counters.map((m) => (
            <article
              key={m.id}
              className="rounded-[var(--radius-lg)] border border-emerald-500/20 bg-emerald-950/30 p-3.5 text-[var(--text)]"
            >
              {m.content}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
