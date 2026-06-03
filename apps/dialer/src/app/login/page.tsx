"use client";

import { useEffect, useRef, useState } from "react";
import { DIALER_USERNAMES, type DialerUsername } from "@/lib/dialer-auth";

export default function LoginPage() {
  const [username, setUsername] = useState<DialerUsername | "">("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setPassword("");
    setUsername("");
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username) {
      setError("Choose david or x");
      return;
    }
    setError(null);
    setLoading(true);

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      setError(json.error ?? "Sign in failed");
      return;
    }

    window.location.href = "/";
  }

  return (
    <main className="auth-page safe-x safe-bottom sm:mx-auto sm:max-w-md">
      <div className="mb-10 text-center animate-fade-in">
        <div
          className="auth-logo mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-[1.35rem] border border-[var(--border)] bg-[var(--surface)] shadow-[0_12px_40px_rgba(52,211,153,0.15)]"
          aria-hidden
        >
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            className="text-[var(--accent)]"
          >
            <path
              d="M7.2 3.2c-.5.2-1 .6-1.2 1.1l-1.1 2.4c-.2.5-.1 1.1.3 1.5l1.6 1.6c2.4 2.4 4.3 4.3 6.7 6.7l1.6 1.6c.4.4 1 .5 1.5.3l2.4-1.1c.5-.2.9-.7 1.1-1.2l.5-1.8c.1-.4-.1-.8-.5-1L17.8 11c-.3-.2-.7-.2-1-.1l-1.2.5c-.8.3-1.7 0-2.3-.6l-2.2-2.2c-.6-.6-.9-1.5-.6-2.3l.5-1.2c.1-.3.1-.7-.1-1L8.2 3.7c-.2-.4-.6-.6-1-.5l-1.8.5z"
              fill="currentColor"
            />
          </svg>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Dialer</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Sign in to start calling
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="glass auth-form rounded-[var(--radius-xl)] p-6 shadow-[0_16px_48px_rgba(0,0,0,0.35)] animate-fade-in"
        autoComplete="off"
      >
        {/* Absorb iOS Keychain autofill so real fields stay empty on load */}
        <input
          type="text"
          name="prevent_autofill_username"
          tabIndex={-1}
          autoComplete="username"
          className="auth-autofill-trap"
          aria-hidden
          readOnly
        />
        <input
          type="password"
          name="prevent_autofill_password"
          tabIndex={-1}
          autoComplete="current-password"
          className="auth-autofill-trap"
          aria-hidden
          readOnly
        />

        <div className="space-y-4">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]">
              Rep
            </p>
            <div className="auth-rep-picker" role="group" aria-label="Choose rep">
              {DIALER_USERNAMES.map((rep) => (
                <button
                  key={rep}
                  type="button"
                  className={`auth-rep-chip ${username === rep ? "auth-rep-chip--active" : ""}`}
                  aria-pressed={username === rep}
                  onClick={() => {
                    setUsername(rep);
                    setError(null);
                  }}
                >
                  {rep.charAt(0).toUpperCase() + rep.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="dialer-pass"
              className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-[var(--text-tertiary)]"
            >
              Password
            </label>
            <input
              ref={passwordRef}
              id="dialer-pass"
              name="dialer-pass"
              type="password"
              required
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              data-1p-ignore
              data-lpignore="true"
              readOnly
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onFocus={(e) => {
                e.currentTarget.removeAttribute("readonly");
              }}
              className="input-premium"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || !username}
          className="btn-primary mt-6 disabled:opacity-50"
        >
          {loading ? "Signing in…" : "Continue"}
        </button>

        {error && <p className="alert-error mt-4">{error}</p>}
      </form>
    </main>
  );
}
