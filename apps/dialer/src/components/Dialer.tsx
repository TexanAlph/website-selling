"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lead, LeadStatus } from "@/lib/leads";
import { OUTCOME_STATUSES } from "@/lib/leads";
import { MOCK_TEST_LEAD } from "@/lib/test-dialer";
import { usePhoneCall } from "@/hooks/usePhoneCall";
import { useLeadQueueCount } from "@/hooks/useLeadQueueCount";
import { useSessionRecap } from "@/hooks/useSessionRecap";
import { useInsights } from "@/hooks/useInsights";
import { apiCreateCallSession, apiFinalizeCallSession } from "@/lib/calls/client";
import { hapticOutcome } from "@/lib/haptics";
import type { DialerUsername } from "@/lib/dialer-auth";
import { formatDialDisplay, phoneToE164 } from "@/lib/phone";
import { useMissedCallBadge } from "@/hooks/useMissedCallBadge";
import { useKeypadCoachDefault } from "@/hooks/useKeypadCoachDefault";
import { PhoneKeypad } from "./PhoneKeypad";
import { LeadsQueue } from "./LeadsQueue";
import { HistoryView } from "./HistoryView";
import { InstallPrompt } from "./InstallPrompt";
import { CoachPanel } from "./CoachPanel";
import { InCallToolbar } from "./InCallToolbar";
import { useMissedUnreadCount } from "@/hooks/useMissedUnreadCount";

type Tab = "keypad" | "queue" | "history";

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
  const [tab, setTab] = useState<Tab>("queue");
  const [lead, setLead] = useState<Lead | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueError, setQueueError] = useState<string | null>(null);
  const [username, setUsername] = useState<DialerUsername | null>(null);
  const [recapSessionId, setRecapSessionId] = useState<string | null>(null);
  const [activeCallSource, setActiveCallSource] = useState<
    "keypad" | "queue" | null
  >(null);
  const [keypadDialDisplay, setKeypadDialDisplay] = useState<string | null>(
    null,
  );

  const phone = usePhoneCall();
  const { defaultOn: keypadCoachDefault } = useKeypadCoachDefault();
  const [keypadCoachThisCall, setKeypadCoachThisCall] = useState(true);
  const testMode = phone.testMode;
  useMissedCallBadge(testMode);
  const configReady = phone.config !== null;
  const storageConfigured = phone.config?.storageConfigured ?? false;
  const { queueCount, setQueueCount, refreshQueueCount } = useLeadQueueCount(
    true,
    testMode,
  );
  const { recap, loading: recapLoading } = useSessionRecap(recapSessionId);
  const {
    data: insights,
    loading: insightsLoading,
    refresh: refreshInsights,
  } = useInsights(tab === "queue");

  const error = queueError ?? phone.error;

  useEffect(() => {
    void fetch("/api/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json?.username) setUsername(json.username as DialerUsername);
      })
      .catch(() => {});
  }, []);

  const fetchNextLead = useCallback(async () => {
    if (!configReady) return;
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
      if (typeof json.queueCount === "number") {
        setQueueCount(json.queueCount);
      }
      void refreshQueueCount();
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : "Failed to load lead");
      setLead(null);
    }
    setLoading(false);
  }, [setQueueCount, testMode, configReady, refreshQueueCount]);

  useEffect(() => {
    if (!configReady) return;
    void fetchNextLead();
  }, [fetchNextLead, configReady]);

  const showRecapForSession = (sessionId: string | null) => {
    if (sessionId && !testMode) setRecapSessionId(sessionId);
  };

  const finalizeSession = async (
    sessionId: string | null,
    opts: {
      outcomeStatus?: LeadStatus | null;
      endReason: "outcome" | "hangup" | "manual";
    },
  ) => {
    if (!sessionId || testMode) return null;
    try {
      const res = await apiFinalizeCallSession(sessionId, opts);
      showRecapForSession(sessionId);
      return res;
    } catch {
      return null;
    }
  };

  const endQueueCall = async () => {
    const sid = phone.getSessionId();
    await phone.endCall(async (endedId) => {
      setActiveCallSource(null);
      setKeypadDialDisplay(null);
      await finalizeSession(endedId ?? sid, { endReason: "manual" });
    });
  };

  const selectRecentLead = (picked: Lead) => {
    setRecapSessionId(null);
    setQueueError(null);
    setLead(picked);
    setTab("queue");
  };

  const { unread: historyUnread, refresh: refreshHistoryUnread } =
    useMissedUnreadCount(testMode);

  const setLeadStatus = async (
    status: LeadStatus,
    outcomeKey: keyof typeof OUTCOME_STATUSES,
  ) => {
    if (!lead) return;
    const leadId = lead.id;
    const sid = phone.getSessionId();
    setLoading(true);
    setQueueError(null);
    hapticOutcome(outcomeKey);

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
    void refreshInsights();
  };

  const callNextLead = async () => {
    if (!lead) return;
    if (phone.calling) {
      await endQueueCall();
      return;
    }

    phone.setError(null);
    setQueueError(null);
    setRecapSessionId(null);

    setActiveCallSource("queue");
    await phone.startCall(lead.phone, {
      beforeConnect: async (sessionId) => {
        if (testMode) {
          setLead({ ...lead, status: "Calling" });
          return;
        }
        try {
          await patchLead(lead.id, "Calling");
        } catch (e) {
          setQueueError(
            e instanceof Error ? e.message : "Lead already claimed",
          );
          await fetchNextLead();
          return;
        }
        await apiCreateCallSession({
          sessionId,
          leadId: lead.id,
          niche: lead.niche,
          source: "queue",
        });
      },
      onDisconnect: async (endedId) => {
        setActiveCallSource(null);
        setKeypadDialDisplay(null);
        await finalizeSession(endedId, { endReason: "hangup" });
      },
    });
  };

  const startOutboundCall = (e164: string) => {
    setActiveCallSource("keypad");
    setKeypadCoachThisCall(keypadCoachDefault);
    const digits = e164.replace(/\D/g, "");
    setKeypadDialDisplay(
      digits.length > 0 ? formatDialDisplay(digits) : e164,
    );
    void phone.startCall(e164, {
      beforeConnect: async (sessionId) => {
        await apiCreateCallSession({
          sessionId,
          source: "keypad",
        });
      },
      onDisconnect: async (endedId) => {
        setActiveCallSource(null);
        setKeypadDialDisplay(null);
        await finalizeSession(endedId, { endReason: "hangup" });
      },
    });
  };

  const handleCallBack = (fromPhone: string) => {
    const e164 = phoneToE164(fromPhone);
    if (!e164) {
      phone.setError("Could not dial that number");
      return;
    }
    if (phone.calling) return;
    phone.setError(null);
    startOutboundCall(e164);
  };

  const endKeypadCall = () => {
    const sid = phone.getSessionId();
    void phone.endCall(async (endedId) => {
      setActiveCallSource(null);
      setKeypadDialDisplay(null);
      await finalizeSession(endedId ?? sid, { endReason: "manual" });
    });
  };

  const endActiveCall = () => {
    if (activeCallSource === "keypad") endKeypadCall();
    else void endQueueCall();
  };

  const onCall = phone.calling && activeCallSource;
  const showLiveCoach = Boolean(
    onCall &&
      (activeCallSource === "queue" ||
        (activeCallSource === "keypad" && keypadCoachThisCall)),
  );
  const coachLeadId =
    activeCallSource === "queue" ? (lead?.id ?? null) : null;
  const coachNicheLabel =
    activeCallSource === "queue"
      ? (lead?.niche?.trim() || null)
      : activeCallSource === "keypad"
        ? "Custom number"
        : null;

  const handleOutcome = (key: keyof typeof OUTCOME_STATUSES) => {
    void setLeadStatus(OUTCOME_STATUSES[key], key);
  };

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const repLabel = username
    ? username.charAt(0).toUpperCase() + username.slice(1)
    : null;

  return (
    <main className="app-shell safe-bottom sm:mx-auto sm:max-w-md">
      <div className="app-chrome safe-x safe-top">
        <header className="flex items-center justify-between gap-2 pb-2">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold tracking-tight">Dialer</h1>
            {repLabel ? (
              <span className="rep-chip">{repLabel}</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="btn-ghost rounded-full px-2.5 py-1 text-xs font-medium text-[var(--text-tertiary)]"
          >
            Sign out
          </button>
        </header>

        <TabSwitcher
          tab={tab}
          queueCount={queueCount}
          historyUnread={historyUnread}
          onChange={setTab}
        />
      </div>

      <InstallPrompt />

      <div
        className={`app-content safe-x${onCall ? " app-content--on-call" : ""}`}
      >
        {onCall ? (
          <div className="in-call-layout">
            <InCallToolbar
              callSource={activeCallSource}
              callPhase={phone.callPhase}
              callStatusLabel={phone.callStatusLabel}
              speakerOn={phone.speakerOn}
              speakerSupported={phone.speakerSupported}
              muted={phone.muted}
              testMode={testMode}
              lead={lead}
              dialDisplay={keypadDialDisplay}
              onEndCall={endActiveCall}
              onToggleSpeaker={() => void phone.toggleSpeaker()}
              onToggleMute={() => phone.toggleMute()}
              keypadCoachThisCall={keypadCoachThisCall}
              onKeypadCoachThisCallChange={setKeypadCoachThisCall}
            />
            {showLiveCoach ? (
              <div className="in-call-coach-pane">
                <CoachPanel
                  sessionId={phone.sessionId}
                  leadId={coachLeadId}
                  nicheLabel={coachNicheLabel}
                  active
                  testMode={testMode}
                />
              </div>
            ) : (
              <div className="keypad-coach-off glass in-call-coach-pane">
                <p className="keypad-coach-off__title">Regular call</p>
                <p className="keypad-coach-off__hint">
                  AI coach is off for this call. Turn it on in the toolbar
                  above, or set the default on the Keypad tab before you dial.
                </p>
              </div>
            )}
            <p className="in-call-tab-hint">
              Switch Keypad, Leads, or History — coach stays here during this
              call.
            </p>
            <div className="in-call-tab-slot">
              {tab === "keypad" ? (
                <PhoneKeypad
                  testMode={phone.testMode}
                  deviceReady={phone.deviceReady}
                  callInProgress
                  error={error}
                  onStartCall={startOutboundCall}
                />
              ) : tab === "queue" ? (
                <LeadsQueue
                  lead={lead}
                  queueCount={queueCount}
                  testMode={phone.testMode}
                  storageConfigured={storageConfigured}
                  loading={loading || !configReady}
                  callInProgress
                  deviceReady={phone.deviceReady}
                  error={error}
                  recap={recap}
                  recapLoading={recapLoading}
                  insights={insights}
                  insightsLoading={insightsLoading}
                  onDismissRecap={() => setRecapSessionId(null)}
                  onRetryQueue={() => void fetchNextLead()}
                  onCallLead={() => void callNextLead()}
                  onOutcome={handleOutcome}
                />
              ) : (
                <HistoryView
                  testMode={testMode}
                  onSelectLead={selectRecentLead}
                  onCallBack={handleCallBack}
                  onUnreadChange={() => void refreshHistoryUnread()}
                />
              )}
            </div>
          </div>
        ) : tab === "keypad" ? (
          <PhoneKeypad
            testMode={phone.testMode}
            deviceReady={phone.deviceReady}
            error={error}
            onStartCall={startOutboundCall}
          />
        ) : tab === "queue" ? (
          <LeadsQueue
            lead={lead}
            queueCount={queueCount}
            testMode={phone.testMode}
            storageConfigured={storageConfigured}
            loading={loading || !configReady}
            deviceReady={phone.deviceReady}
            error={error}
            recap={recap}
            recapLoading={recapLoading}
            insights={insights}
            insightsLoading={insightsLoading}
            onDismissRecap={() => setRecapSessionId(null)}
            onRetryQueue={() => void fetchNextLead()}
            onCallLead={() => void callNextLead()}
            onOutcome={handleOutcome}
          />
        ) : (
          <HistoryView
            testMode={testMode}
            onSelectLead={selectRecentLead}
            onCallBack={handleCallBack}
            onUnreadChange={() => void refreshHistoryUnread()}
          />
        )}
      </div>
    </main>
  );
}

function TabSwitcher({
  tab,
  queueCount,
  historyUnread,
  onChange,
}: {
  tab: Tab;
  queueCount: number | null;
  historyUnread: number;
  onChange: (tab: Tab) => void;
}) {
  const leadsBadge =
    queueCount === null ? null : queueCount > 99 ? "99+" : String(queueCount);
  const historyBadge =
    historyUnread > 0
      ? historyUnread > 99
        ? "99+"
        : String(historyUnread)
      : null;

  return (
    <div
      className="segmented segmented--three relative mb-3"
      role="tablist"
      aria-label="Dialer mode"
    >
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
        {leadsBadge !== null ? (
          <span className="segmented-badge" aria-label={`${queueCount} in queue`}>
            {leadsBadge}
          </span>
        ) : null}
      </label>

      <input
        id="tab-history"
        type="radio"
        name="dialer-tab"
        className="segmented-input"
        checked={tab === "history"}
        onChange={() => onChange("history")}
      />
      <label htmlFor="tab-history" className="segmented-label" role="tab">
        History
        {historyBadge !== null ? (
          <span
            className="segmented-badge segmented-badge--alert"
            aria-label={`${historyUnread} unread missed`}
          >
            {historyBadge}
          </span>
        ) : null}
      </label>
    </div>
  );
}
