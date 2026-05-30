"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lead, LeadStatus } from "@/lib/leads";
import { OUTCOME_STATUSES } from "@/lib/leads";
import { isTestDialerMode, MOCK_TEST_LEAD } from "@/lib/test-dialer";
import { usePhoneCall } from "@/hooks/usePhoneCall";
import { apiCreateCallSession, apiFinalizeCallSession } from "@/lib/calls/client";
import { PhoneKeypad } from "./PhoneKeypad";
import { LeadsQueue } from "./LeadsQueue";

const testMode = isTestDialerMode();

type Tab = "keypad" | "queue";

async function patchLead(id: string, status: LeadStatus) {
  const res = await fetch(`/api/leads/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    throw new Error(json.error ?? "Update failed");
  }
}

export function Dialer() {
  const [tab, setTab] = useState<Tab>("keypad");
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const phone = usePhoneCall();

  const error = queueError ?? phone.error;

  const fetchNextLead = useCallback(async () => {
    if (testMode) {
      setLead({ ...MOCK_TEST_LEAD, status: "New" });
      setLoading(false);
      return;
    }

    setLoading(true);
    setQueueError(null);
    try {
      const res = await fetch("/api/leads/next");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load lead");
      setLead(json.lead as Lead | null);
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : "Failed to load lead");
      setLead(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchNextLead();
  }, [fetchNextLead]);

  const resetLeadAfterCall = async () => {
    if (testMode && lead) {
      setLead({ ...lead, status: "New" });
    } else if (lead) {
      try {
        await patchLead(lead.id, "New");
      } catch {
        /* ignore */
      }
    }
  };

  const finalizeSession = async (
    sessionId: string | null,
    opts: {
      outcomeStatus?: LeadStatus | null;
      endReason: "outcome" | "hangup" | "manual";
    },
  ) => {
    if (!sessionId || testMode) return;
    try {
      await apiFinalizeCallSession(sessionId, opts);
    } catch {
      /* non-blocking — queue still works */
    }
  };

  const endQueueCall = async () => {
    const sid = phone.getSessionId();
    await phone.endCall(async (endedId) => {
      await finalizeSession(endedId ?? sid, { endReason: "manual" });
      await resetLeadAfterCall();
    });
  };

  const setLeadStatus = async (status: LeadStatus) => {
    if (!lead) return;
    const leadId = lead.id;
    const sid = phone.getSessionId();
    setLoading(true);
    setQueueError(null);

    if (testMode) {
      if (phone.calling) await phone.endCall();
      setLead({ ...MOCK_TEST_LEAD, status: "New" });
      setLoading(false);
      return;
    }

    try {
      await finalizeSession(sid, {
        outcomeStatus: status,
        endReason: "outcome",
      });
      if (phone.calling) await phone.endCall();
      await patchLead(leadId, status);
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : "Update failed");
      setLoading(false);
      return;
    }

    await fetchNextLead();
  };

  const callNextLead = async () => {
    if (!lead) return;
    if (phone.calling) {
      await endQueueCall();
      return;
    }

    phone.setError(null);
    setQueueError(null);

    await phone.startCall(lead.phone, {
      beforeConnect: async (sessionId) => {
        if (testMode) {
          setLead({ ...lead, status: "Calling" });
          return;
        }
        await patchLead(lead.id, "Calling");
        await apiCreateCallSession({
          sessionId,
          leadId: lead.id,
          niche: lead.niche,
          source: "queue",
        });
      },
      onDisconnect: async (endedId) => {
        await finalizeSession(endedId, { endReason: "hangup" });
        await resetLeadAfterCall();
      },
    });
  };

  const startKeypadCall = (e164: string) => {
    void phone.startCall(e164, {
      beforeConnect: async (sessionId) => {
        await apiCreateCallSession({
          sessionId,
          source: "keypad",
        });
      },
      onDisconnect: async (endedId) => {
        await finalizeSession(endedId, { endReason: "hangup" });
      },
    });
  };

  const endKeypadCall = () => {
    const sid = phone.getSessionId();
    void phone.endCall(async (endedId) => {
      await finalizeSession(endedId ?? sid, { endReason: "manual" });
    });
  };

  const handleOutcome = (key: keyof typeof OUTCOME_STATUSES) => {
    void setLeadStatus(OUTCOME_STATUSES[key]);
  };

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  return (
    <main className="app-shell safe-bottom sm:mx-auto sm:max-w-md">
      <div className="app-chrome safe-x safe-top">
        <header className="flex items-center justify-between gap-2 pb-2">
          <h1 className="text-lg font-semibold tracking-tight">Dialer</h1>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void signOut()}
              className="btn-ghost rounded-full px-2.5 py-1 text-xs font-medium text-[var(--text-tertiary)]"
            >
              Sign out
            </button>
          </div>
        </header>

        <TabSwitcher tab={tab} onChange={setTab} />
      </div>

      <div className="app-content safe-x">
      {tab === "keypad" ? (
        <PhoneKeypad
          testMode={phone.testMode}
          deviceReady={phone.deviceReady}
          calling={phone.calling}
          sessionId={phone.sessionId}
          error={error}
          onStartCall={startKeypadCall}
          onEndCall={endKeypadCall}
        />
      ) : (
        <LeadsQueue
          lead={lead}
          loading={loading}
          calling={phone.calling}
          deviceReady={phone.deviceReady}
          testMode={phone.testMode}
          sessionId={phone.sessionId}
          error={error}
          onCallLead={() => void callNextLead()}
          onOutcome={handleOutcome}
        />
      )}
      </div>
    </main>
  );
}

function TabSwitcher({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (tab: Tab) => void;
}) {
  return (
    <div className="segmented relative mb-3" role="tablist" aria-label="Dialer mode">
      <input
        id="tab-keypad"
        type="radio"
        name="dialer-tab"
        className="segmented-input"
        checked={tab === "keypad"}
        onChange={() => onChange("keypad")}
      />
      <label htmlFor="tab-keypad" className="segmented-label" role="tab">
        Keypad
      </label>

      <input
        id="tab-leads"
        type="radio"
        name="dialer-tab"
        className="segmented-input"
        checked={tab === "queue"}
        onChange={() => onChange("queue")}
      />
      <label htmlFor="tab-leads" className="segmented-label" role="tab">
        Leads
      </label>
    </div>
  );
}
