import type { Lead, LeadStatus } from "@/lib/leads";

type Props = {
  lead: Lead | null;
  loading?: boolean;
  calling?: boolean;
  variant?: "compact" | "strip";
};

const STATUS_STYLE: Partial<Record<LeadStatus, string>> = {
  New: "border-zinc-500/30 bg-zinc-800/50 text-zinc-300",
  Calling: "border-emerald-500/35 bg-emerald-950/50 text-emerald-300",
  "Wrong Number": "border-red-500/30 bg-red-950/40 text-red-200",
  "Not Interested": "border-amber-500/30 bg-amber-950/40 text-amber-100",
  "Interested/Closed": "border-emerald-500/40 bg-emerald-900/50 text-emerald-100",
};

export function LeadCard({
  lead,
  loading,
  calling,
  variant = "compact",
}: Props) {
  if (loading) {
    return (
      <section className="lead-card glass animate-pulse">
        <div className="h-3 w-20 rounded-full bg-white/10" />
        <div className="mt-2 h-5 w-3/4 rounded bg-white/10" />
      </section>
    );
  }

  if (!lead) {
    return (
      <section className="lead-card lead-card--empty glass">
        <p className="text-sm font-medium">Queue empty</p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Run the scraper on the Mac Mini to refill your queue.
        </p>
      </section>
    );
  }

  const websiteLabel = lead.website?.trim()
    ? lead.website
    : "No website";

  const statusClass =
    STATUS_STYLE[calling ? "Calling" : lead.status] ?? STATUS_STYLE.New;

  if (variant === "strip") {
    return (
      <section className="lead-card lead-card--strip glass">
        <div className="lead-card-strip-row">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{lead.business_name}</p>
            <a
              href={`tel:${lead.phone.replace(/\D/g, "")}`}
              className="mt-0.5 block truncate font-mono text-xs tabular-nums text-[var(--accent)]"
            >
              {lead.phone}
            </a>
          </div>
          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${statusClass}`}
          >
            On call
          </span>
        </div>
      </section>
    );
  }

  return (
    <section className="lead-card glass">
      <div className="lead-card-row">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-lg font-semibold leading-snug tracking-tight">
            {lead.business_name}
          </h2>
          <div className="mt-1 flex items-center gap-1.5">
            {lead.niche ? (
              <span className="text-xs text-[var(--text-secondary)]">
                {lead.niche}
              </span>
            ) : null}
            {!lead.website && (
              <>
                {lead.niche && <span className="text-[var(--text-tertiary)]">·</span>}
                <span className="text-xs font-semibold text-[var(--gold)]">No website</span>
              </>
            )}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase ${statusClass}`}
        >
          {lead.status}
        </span>
      </div>

      <a
        href={`tel:${lead.phone.replace(/\D/g, "")}`}
        className="lead-card-phone"
      >
        {lead.phone}
      </a>

      {lead.website ? (
        <a
          href={
            lead.website.startsWith("http")
              ? lead.website
              : `https://${lead.website}`
          }
          target="_blank"
          rel="noopener noreferrer"
          className="lead-card-website"
        >
          {websiteLabel}
        </a>
      ) : null}
    </section>
  );
}
