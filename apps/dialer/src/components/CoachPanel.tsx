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
    <section className="flex min-h-0 flex-1 flex-col rounded-2xl bg-[var(--card)] p-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
          AI Coach
        </h2>
        {stack && (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-400">
            {stack.labels.stt}
          </span>
        )}
      </div>
      <div
        ref={scrollRef}
        className="mt-3 flex-1 space-y-3 overflow-y-auto text-sm leading-relaxed"
      >
        {counters.length === 0 ? (
          <p className="text-[var(--muted)]">
            {active
              ? "Listening… counter-objections appear here in real time."
              : "Start a call to activate the coach."}
          </p>
        ) : (
          counters.map((m) => (
            <article
              key={m.id}
              className="rounded-xl border border-emerald-900/50 bg-emerald-950/40 p-3"
            >
              {m.content}
            </article>
          ))
        )}
      </div>
    </section>
  );
}
