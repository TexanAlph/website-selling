import type { Lead } from "@/lib/leads";

type Props = {
  lead: Lead | null;
  loading?: boolean;
};

export function LeadCard({ lead, loading }: Props) {
  if (loading) {
    return (
      <section className="rounded-2xl bg-[var(--card)] p-5 animate-pulse safe-top">
        <div className="h-6 w-2/3 rounded bg-zinc-800" />
        <div className="mt-3 h-4 w-1/3 rounded bg-zinc-800" />
        <div className="mt-4 h-4 w-full rounded bg-zinc-800" />
      </section>
    );
  }

  if (!lead) {
    return (
      <section className="rounded-2xl bg-[var(--card)] p-5 text-center safe-top">
        <p className="text-lg font-semibold">Queue empty</p>
        <p className="mt-2 text-sm text-[var(--muted)]">
          Run the Mac Mini scraper or add leads in Supabase.
        </p>
      </section>
    );
  }

  const websiteLabel = lead.website?.trim()
    ? lead.website
    : "No website — strong pitch angle";

  return (
    <section className="rounded-2xl bg-[var(--card)] p-5 shadow-lg safe-top">
      <p className="text-xs uppercase tracking-wider text-[var(--muted)]">
        Current lead
      </p>
      <h1 className="mt-1 text-2xl font-bold leading-tight">
        {lead.business_name}
      </h1>
      <p className="mt-2 text-sm text-emerald-400">{lead.niche ?? "Local service"}</p>
      <p className="mt-4 text-sm text-[var(--muted)]">Website</p>
      {lead.website ? (
        <a
          href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block break-all text-base text-sky-400 underline"
        >
          {websiteLabel}
        </a>
      ) : (
        <p className="mt-1 text-base text-amber-400">{websiteLabel}</p>
      )}
      <p className="mt-3 text-xs text-zinc-500">{lead.phone}</p>
    </section>
  );
}
