"use client";

import { useCallback, useEffect, useState } from "react";
import type { Lead } from "@/lib/leads";

type Props = {
  testMode: boolean;
  onSelectLead: (lead: Lead) => void;
  embedded?: boolean;
};

export function RecentLeadsPanel({
  testMode,
  onSelectLead,
  embedded = false,
}: Props) {
  const [open, setOpen] = useState(embedded);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (testMode) {
      setLeads([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leads/recent");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load");
      setLeads((json.leads as Lead[]) ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setLeads([]);
    }
    setLoading(false);
  }, [testMode]);

  useEffect(() => {
    if (!embedded && !open) return;
    void load();
  }, [embedded, open, load]);

  const body = (
    <div className="recent-leads-body">
          <p className="recent-leads-hint">
            Tap a past lead to see their number and call again.
          </p>
          {loading ? (
            <p className="recent-leads-muted">Loading…</p>
          ) : null}
          {error ? <p className="alert-error text-xs">{error}</p> : null}
          {!loading && !error && leads.length === 0 ? (
            <p className="recent-leads-muted">No logged outcomes yet.</p>
          ) : null}
          <ul className="recent-leads-list">
            {leads.map((lead) => (
              <li key={lead.id}>
                <button
                  type="button"
                  className="recent-leads-item"
                  onClick={() => onSelectLead(lead)}
                >
                  <span className="recent-leads-name">{lead.business_name}</span>
                  <span className="recent-leads-meta">
                    {lead.status.replace("/", " · ")} · {lead.phone}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
  );

  if (embedded) {
    return (
      <div className="recent-leads recent-leads--embedded">
        <p className="recent-leads-embedded-title">Recent leads</p>
        {body}
      </div>
    );
  }

  return (
    <section className="recent-leads glass">
      <button
        type="button"
        className="recent-leads-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Past leads</span>
        <span className="recent-leads-chevron" aria-hidden>
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? body : null}
    </section>
  );
}
