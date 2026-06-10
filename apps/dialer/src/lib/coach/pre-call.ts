import {
  anticipateObjections,
  type ObjectionVars,
} from "./objection-library";

export type PreCallBrief = {
  opener: string;
  objections: Array<{ label: string; line: string }>;
};

/**
 * All deterministic — zero LLM calls. Called client-side with vars from
 * the /api/coach/config response so no env reads happen in the browser.
 */
export function buildPreCallBrief(
  niche: string | null,
  vars: ObjectionVars,
): PreCallBrief {
  const nicheLabel = niche?.trim() || "local service";
  const opener = `We help ${nicheLabel} businesses in the area build professional websites for ${vars.price} one-time — worth thirty seconds or bad time?`;
  const objections = anticipateObjections("opening", [], vars, 2);
  return { opener, objections };
}
