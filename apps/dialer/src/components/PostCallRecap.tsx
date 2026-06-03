"use client";

import type { SessionRecap } from "@/lib/calls/types";

type Props = {
  recap: SessionRecap | null;
  loading: boolean;
  onDismiss: () => void;
  embedded?: boolean;
};

export function PostCallRecap({
  recap,
  loading,
  onDismiss,
  embedded = false,
}: Props) {
  if (!loading && !recap) return null;

  return (
    <section
      className={
        embedded ? "post-call-recap post-call-recap--embedded" : "post-call-recap glass"
      }
      aria-live="polite"
    >
      <div className="post-call-recap-header">
        <h3 className="post-call-recap-title">Call recap</h3>
        <button
          type="button"
          onClick={onDismiss}
          className="btn-ghost post-call-dismiss"
          aria-label="Dismiss recap"
        >
          ×
        </button>
      </div>

      {loading && !recap?.summary ? (
        <p className="post-call-recap-loading">Analyzing call…</p>
      ) : null}

      {recap?.summary ? (
        <p className="post-call-recap-summary">{recap.summary}</p>
      ) : null}

      {recap?.repScore != null ? (
        <p className="post-call-recap-score">
          Score: <strong>{recap.repScore}</strong>/10
        </p>
      ) : null}

      {recap?.openerSuggestion ? (
        <div className="post-call-recap-block">
          <span className="post-call-recap-label">Tomorrow opener</span>
          <p>{recap.openerSuggestion}</p>
        </div>
      ) : null}

      {recap?.objections && recap.objections.length > 0 ? (
        <div className="post-call-recap-block">
          <span className="post-call-recap-label">Objections</span>
          <ul className="post-call-recap-list">
            {recap.objections.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {recap?.recommendations ? (
        <div className="post-call-recap-block">
          <span className="post-call-recap-label">Improve next time</span>
          <p>{recap.recommendations}</p>
        </div>
      ) : null}
    </section>
  );
}
