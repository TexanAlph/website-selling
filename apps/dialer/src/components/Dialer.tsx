"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Device, Call } from "@twilio/voice-sdk";
import { v4 as uuidv4 } from "uuid";
import { createClient } from "@/lib/supabase/client";
import type { Lead, LeadStatus } from "@/lib/leads";
import { OUTCOME_STATUSES } from "@/lib/leads";
import { enableWakeLock, disableWakeLock } from "@/lib/wake-lock";
import { LeadCard } from "./LeadCard";
import { CoachPanel } from "./CoachPanel";

export function Dialer() {
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [calling, setCalling] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deviceReady, setDeviceReady] = useState(false);
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<Call | null>(null);
  const supabase = useMemo(() => createClient(), []);

  const fetchNextLead = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("leads")
      .select("*")
      .eq("status", "New")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (qErr) {
      setError(qErr.message);
      setLead(null);
    } else {
      setLead(data as Lead | null);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    void fetchNextLead();
  }, [fetchNextLead]);

  useEffect(() => {
    let cancelled = false;

    async function initDevice() {
      try {
        const res = await fetch("/api/twilio/token");
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Token failed");

        const device = new Device(json.token, {
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
          closeProtection: true,
        });

        device.on("registered", () => {
          if (!cancelled) setDeviceReady(true);
        });
        device.on("error", (e) => {
          if (!cancelled) setError(e.message);
        });

        await device.register();
        deviceRef.current = device;
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Twilio init failed");
        }
      }
    }

    void initDevice();

    return () => {
      cancelled = true;
      deviceRef.current?.destroy();
      deviceRef.current = null;
    };
  }, []);

  const setLeadStatus = async (status: LeadStatus) => {
    if (!lead) return;
    setLoading(true);
    const { error: uErr } = await supabase
      .from("leads")
      .update({ status })
      .eq("id", lead.id);

    if (uErr) {
      setError(uErr.message);
      setLoading(false);
      return;
    }

    if (activeCallRef.current) {
      activeCallRef.current.disconnect();
      activeCallRef.current = null;
    }
    setCalling(false);
    await disableWakeLock();
    setSessionId(null);
    await fetchNextLead();
  };

  const callNextLead = async () => {
    if (!lead?.phone || !deviceRef.current) return;
    setError(null);
    const sid = uuidv4();
    setSessionId(sid);

    try {
      await enableWakeLock();
      await supabase
        .from("leads")
        .update({ status: "Calling" })
        .eq("id", lead.id);

      const call = await deviceRef.current.connect({
        params: { To: lead.phone },
      });

      activeCallRef.current = call;
      setCalling(true);

      call.on("disconnect", async () => {
        setCalling(false);
        await disableWakeLock();
        if (lead.status === "Calling") {
          await supabase
            .from("leads")
            .update({ status: "New" })
            .eq("id", lead.id);
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Call failed");
      setCalling(false);
      await disableWakeLock();
    }
  };

  const handleOutcome = (key: keyof typeof OUTCOME_STATUSES) => {
    void setLeadStatus(OUTCOME_STATUSES[key]);
  };

  return (
    <main className="mx-auto flex h-dvh max-w-lg flex-col gap-4 px-4 pb-6 safe-bottom">
      <LeadCard lead={lead} loading={loading && !lead} />

      {error && (
        <p className="rounded-lg bg-red-950/60 px-3 py-2 text-sm text-red-300">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={!lead || !deviceReady || calling}
        onClick={() => void callNextLead()}
        className="w-full rounded-2xl bg-[var(--accent)] py-6 text-xl font-bold text-black shadow-lg transition active:scale-[0.98] disabled:opacity-40"
      >
        {calling ? "On call…" : deviceReady ? "Call Next Lead" : "Connecting…"}
      </button>

      <CoachPanel
        sessionId={sessionId}
        leadId={lead?.id ?? null}
        active={calling}
      />

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <OutcomeButton
          label="Wrong Number"
          tone="danger"
          disabled={!lead || loading}
          onClick={() => handleOutcome("wrong")}
        />
        <OutcomeButton
          label="Not Interested"
          tone="warn"
          disabled={!lead || loading}
          onClick={() => handleOutcome("not_interested")}
        />
        <OutcomeButton
          label="Interested / Closed"
          tone="accent"
          disabled={!lead || loading}
          onClick={() => handleOutcome("interested")}
        />
      </div>
    </main>
  );
}

function OutcomeButton({
  label,
  tone,
  disabled,
  onClick,
}: {
  label: string;
  tone: "danger" | "warn" | "accent";
  disabled: boolean;
  onClick: () => void;
}) {
  const colors = {
    danger: "bg-red-600/90 text-white",
    warn: "bg-amber-600/90 text-black",
    accent: "bg-emerald-600 text-black",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-xl px-3 py-4 text-sm font-semibold ${colors[tone]} disabled:opacity-40`}
    >
      {label}
    </button>
  );
}
