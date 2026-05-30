"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const redirectTo = `${window.location.origin}/`;
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (authError) {
      setError(authError.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 safe-top safe-bottom">
      <h1 className="text-2xl font-bold">Web Dialer</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        Sign in with your work email (you + employee accounts in Supabase Auth).
      </p>
      {sent ? (
        <p className="mt-6 rounded-xl bg-emerald-950/50 p-4 text-emerald-300">
          Check your email for the magic link.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <input
            type="email"
            required
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-base outline-none focus:border-emerald-500"
          />
          <button
            type="submit"
            className="w-full rounded-xl bg-[var(--accent)] py-3 font-semibold text-black"
          >
            Send magic link
          </button>
          {error && <p className="text-sm text-red-400">{error}</p>}
        </form>
      )}
    </main>
  );
}
