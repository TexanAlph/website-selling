"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Lead } from "@/lib/leads";
import type { MissedCall } from "@/lib/calls/inbound";
import {
  hasVoicemail,
  isMissedUnread,
  missedCallLabel,
} from "@/lib/calls/inbound";
import { isHistoryUnavailable, readFetchError } from "@/lib/history-api";

type Props = {
  testMode: boolean;
  onSelectLead: (lead: Lead) => void;
  onCallBack: (phone: string) => void;
  variant?: "page" | "collapsible";
  onUnreadChange?: (count: number) => void;
};

function formatWhen(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function CallHistoryPanel({
  testMode,
  onSelectLead,
  onCallBack,
  variant = "page",
  onUnreadChange,
}: Props) {
  const page = variant === "page";
  const [open, setOpen] = useState(page);
  const [missed, setMissed] = useState<MissedCall[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [missedUnavailable, setMissedUnavailable] = useState(false);
  const [missedError, setMissedError] = useState<string | null>(null);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const unreadCount = missed.filter(isMissedUnread).length;

  useEffect(() => {
    onUnreadChange?.(unreadCount);
  }, [unreadCount, onUnreadChange]);

  const load = useCallback(async () => {
    if (testMode) {
      setMissed([]);
      setLeads([]);
      setMissedUnavailable(false);
      setMissedError(null);
      setLeadsError(null);
      setPlaybackError(null);
      return;
    }
    setLoading(true);
    setMissedUnavailable(false);
    setMissedError(null);
    setLeadsError(null);
    setPlaybackError(null);

    const missedRes = await fetch("/api/calls/missed");
    if (missedRes.ok) {
      const missedJson = (await missedRes.json()) as { calls?: MissedCall[] };
      setMissed(missedJson.calls ?? []);
    } else {
      const msg = await readFetchError(missedRes);
      if (isHistoryUnavailable(msg)) {
        setMissed([]);
        setMissedUnavailable(true);
      } else {
        setMissed([]);
        setMissedError(msg);
      }
    }

    const leadsRes = await fetch("/api/leads/recent");
    if (leadsRes.ok) {
      const leadsJson = (await leadsRes.json()) as { leads?: Lead[] };
      setLeads(leadsJson.leads ?? []);
    } else {
      const msg = await readFetchError(leadsRes);
      setLeads([]);
      if (!isHistoryUnavailable(msg)) {
        setLeadsError(msg);
      }
    }

    setLoading(false);
  }, [testMode]);

  useEffect(() => {
    if (!page && !open) return;
    void load();
  }, [page, open, load]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
    };
  }, []);

  async function playVoicemail(call: MissedCall, e: React.MouseEvent) {
    e.stopPropagation();
    if (!hasVoicemail(call)) return;
    audioRef.current?.pause();
    setPlayingId(call.id);
    setPlaybackError(null);
    const audio = new Audio(`/api/calls/missed/${call.id}/audio`);
    audioRef.current = audio;
    audio.onended = () => {
      setPlayingId(null);
      setMissed((prev) =>
        prev.map((c) =>
          c.id === call.id ? { ...c, listened_at: new Date().toISOString() } : c,
        ),
      );
    };
    audio.onerror = () => {
      setPlayingId(null);
      setPlaybackError("Could not play voicemail");
    };
    try {
      await audio.play();
    } catch {
      setPlayingId(null);
      setPlaybackError("Tap Voicemail again");
    }
  }

  function handleCallBack(call: MissedCall, e: React.MouseEvent) {
    e.stopPropagation();
    onCallBack(call.from_phone);
  }

  const body = (
    <div className="call-history-body animate-fade-in">
      {loading ? <p className="call-history-muted">Loading…</p> : null}
      {playbackError ? (
        <p className="call-history-muted">{playbackError}</p>
      ) : null}
      {leadsError ? (
        <p className="call-history-warn">{leadsError}</p>
      ) : null}

      <div className="call-history-section">
        <p className="call-history-section-title">Missed calls</p>
        {missedError ? (
          <p className="call-history-warn">{missedError}</p>
        ) : null}
        {!loading && missed.length === 0 && !missedError ? (
          <p className="call-history-muted">No missed calls.</p>
        ) : null}
        {missedUnavailable ? (
          <p className="call-history-setup-hint">
            Inbound history needs the latest Mac Mini API. Voicemail still
            records; list appears after the server is updated.
          </p>
        ) : null}
        {missed.length > 0 ? (
          <ul className="call-history-list">
            {missed.map((call) => {
              const unread = isMissedUnread(call);
              return (
                <li key={call.id} className="call-history-row">
                  <div
                    className={`call-history-item ${unread ? "call-history-item--missed" : ""}`}
                  >
                    <span className="call-history-item__dot" aria-hidden />
                    <div className="call-history-item__main">
                      <span className="call-history-item__name">
                        {missedCallLabel(call)}
                      </span>
                      <span className="call-history-item__meta">
                        {call.from_phone}
                        {call.duration_seconds
                          ? ` · ${call.duration_seconds}s`
                          : ""}
                      </span>
                      <span className="call-history-item__when">
                        {formatWhen(call.created_at)}
                        {playingId === call.id ? " · Playing…" : ""}
                      </span>
                    </div>
                  </div>
                  <div className="call-history-row-actions">
                    {hasVoicemail(call) ? (
                      <button
                        type="button"
                        className="call-history-action call-history-action--ghost"
                        onClick={(e) => void playVoicemail(call, e)}
                      >
                        Voicemail
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="call-history-action call-history-action--call"
                      onClick={(e) => handleCallBack(call, e)}
                    >
                      Call back
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>

      <div className="call-history-section">
        <p className="call-history-section-title">Past leads</p>
        {!loading && leads.length === 0 && !leadsError ? (
          <p className="call-history-muted">No logged outcomes yet.</p>
        ) : null}
        <ul className="call-history-list">
          {leads.map((lead) => (
            <li key={lead.id}>
              <button
                type="button"
                className="call-history-item call-history-item--button"
                onClick={() => onSelectLead(lead)}
              >
                <span className="call-history-item__main">
                  <span className="call-history-item__name">
                    {lead.business_name}
                  </span>
                  <span className="call-history-item__meta">
                    {lead.status.replace("/", " · ")} · {lead.phone}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  if (page) {
    return (
      <section className="call-history call-history--page glass">
        {body}
      </section>
    );
  }

  return (
    <section className="call-history glass">
      <button
        type="button"
        className="call-history-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="call-history-toggle__label">
          Call history
          {unreadCount > 0 ? (
            <span className="call-history-badge">{unreadCount}</span>
          ) : null}
        </span>
        <span className="call-history-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? body : null}
    </section>
  );
}
