"use client";

import { useEffect, useState } from "react";
import { buildPreCallBrief } from "@/lib/coach/pre-call";
import type { ObjectionVars } from "@/lib/coach/objection-library";

type CoachConfig = {
  companyName: string;
  offerPrice: string;
  targetGeo: string;
};

const DEFAULT_VARS: ObjectionVars = {
  price: "$599",
  companyName: "Apex Build Partners",
  deliveryTimeline: "3 days",
};

function useCoachVars(): ObjectionVars {
  const [vars, setVars] = useState<ObjectionVars>(DEFAULT_VARS);
  useEffect(() => {
    void fetch("/api/coach/config")
      .then((r) => r.json() as Promise<CoachConfig>)
      .then((cfg) => {
        if (cfg.offerPrice || cfg.companyName) {
          setVars({
            price: cfg.offerPrice || DEFAULT_VARS.price,
            companyName: cfg.companyName || DEFAULT_VARS.companyName,
            deliveryTimeline: DEFAULT_VARS.deliveryTimeline,
          });
        }
      })
      .catch(() => {/* use defaults */});
  }, []);
  return vars;
}

type Props = {
  niche: string | null;
};

export function PreCallBrief({ niche }: Props) {
  const vars = useCoachVars();
  const brief = buildPreCallBrief(niche, vars);

  return (
    <div className="brief-card">
      <p className="brief-card__label">Your opener</p>
      <p className="brief-card__opener">{brief.opener}</p>
      {brief.objections.length ? (
        <div className="brief-card__objections">
          {brief.objections.map((o) => (
            <div key={o.label} className="brief-card__objection">
              <span className="brief-card__objection-label">
                If &ldquo;{o.label}&rdquo;
              </span>
              <span className="brief-card__objection-line">{o.line}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
