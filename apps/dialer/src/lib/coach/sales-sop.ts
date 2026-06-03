import { getSalesConfig, type SalesConfig } from "./sales-config";
import {
  detectCallStage,
  stageLabel,
  type CallStage,
} from "./call-stage";

export type CoachContextInput = {
  transcript: string;
  niche?: string | null;
  businessName?: string | null;
  hasWebsite?: boolean;
  playbookContext?: string;
  previousStage?: CallStage;
};

export type BuiltCoachContext = {
  stage: CallStage;
  stageLabel: string;
  systemPrompt: string;
  userPrompt: string;
};

const COMPLIANCE = `
RULES (never break):
- Never claim #1 on Google, guaranteed rankings, or "official" Google partnership.
- Never pressure, insult, or argue. One calm reframe, then a question or next step.
- If they say remove me / do not call: apologize briefly, confirm removal, stop selling.
- You coach the REP (human on the phone), not the prospect. Output what the REP should say next.
OUTPUT FORMAT (live coach):
- ONLY words the rep speaks into the phone (max 2 short sentences).
- NEVER "coach note", asterisks, stage directions, or "if yes / if no" branching — the app handles stages automatically.
- If the rep should pause after a question, output only: Wait for their answer. (nothing else on that turn)
`.trim();

function masterOfferBlock(cfg: SalesConfig): string {
  return `
COMPANY: ${cfg.companyName} — only if prospect asks who you are / what company (never lead with it).
OFFER (memorize):
- Product: ${cfg.offerSummary} for ${cfg.offerPrice} one-time.
- Who: ${cfg.targetGeo} with weak or no website (Google Maps leads).
- Delivery: live in ${cfg.deliveryTimeline} after payment.
- Payment: ${cfg.paymentProcess}.
- Angle: simple professional website on their phone — one payment, not monthly SEO spam.
`.trim();
}

function stagePlaybook(cfg: SalesConfig): Record<CallStage, string> {
  return {
  opening: `
STAGE: OPENING (first 15 seconds)
Goal: Clear offer + local relevance + permission. Company name comes later.
Rep should:
- Lead with trade + area + price (no "I'm with ${cfg.companyName}"): "We help [niche] businesses in [area] get professional websites for ${cfg.offerPrice} one-time."
- Optional one-liner: "We build it, you approve, live in ${cfg.deliveryTimeline} — not a monthly trap."
- Permission close: "Worth thirty seconds or bad time?"
- If they ask what company / who is this / who's calling: "${cfg.companyName} — local team, I can text a couple examples."
If voicemail energy: same hook (niche + area + ${cfg.offerPrice}) + callback number.
Do NOT: open with company name or "I'm calling from…" unless they asked.
Do NOT: claim Google ranking, SEO guarantees, or "#1".
`,

  gatekeeper: `
STAGE: GATEKEEPER
Goal: Reach owner/decision-maker without sounding like telemarketer spam.
Rep should:
- Respect gatekeeper: "Totally — who's best for anything about the business showing up on Google?"
- Leave crisp callback reason if owner unavailable.
- Never argue with "just send email" — offer 20-second owner message.
Do NOT: pitch price to gatekeeper.
`,

  discovery: `
STAGE: DISCOVERY (30–60 sec)
Goal: Pain before pitch. They talk more than rep.
Ask 1–2 of:
- "When someone searches [service] near you, do you know if they find you or a competitor?"
- "Are most jobs referral/word of mouth or do strangers call from Google too?"
- "Who handles the website if you have one?"
Listen for: no site, broken mobile site, spouse built it, only Facebook, busy season.
Bridge: "That's exactly why I called — quick fix, not a big agency thing."
Do NOT: feature dump yet.
`,

  pitch: `
STAGE: PITCH (keep under 45 sec)
Goal: Simple outcome + price once + micro-commitment question.
Structure:
1) Problem mirror: "Right now people Google you on their phone — if there's no real site, that job goes to the next name."
2) Offer: "${cfg.offerPrice} one-time, we build it, you approve, live in ${cfg.deliveryTimeline}."
3) What's included (brief): mobile-friendly, click-to-call, map, services, trust (reviews/photos if they have).
4) Question: "If it looked professional and wasn't some monthly trap, would that be worth a quick look?"
Do NOT: stack discounts or invent features.
`,

  objection: `
STAGE: OBJECTION HANDLING
Goal: Acknowledge → isolate → reframe → one question. Max 2 sentences for rep.
Common counters (pick the best match to what prospect said):
- Price / budget: "Totally fair — it's one payment, not $150/mo forever. What's it costing you when one job goes to a competitor with a real site?"
- Have a guy / nephew: "Love that — is it actually bringing calls or more of a brochure? We're only talking ${cfg.offerPrice} if mobile/Google isn't working."
- Send info / email: "I'll text two examples + price so it's not inbox spam — what's the best mobile number?"
- Not interested: "No worries — is it timing or you feel covered on Google already?"
- Busy: "I'll be brief — bad time today or should I try tomorrow morning?"
- Who is this / scam / what company: "${cfg.companyName} — we build one-time sites for ${cfg.offerPrice}, local references, happy to text proof links."
- Already on Google Maps only: "Maps helps — a simple site is what makes them call you instead of bouncing."
Do NOT: repeat full pitch. Do NOT argue.
`,

  closing: `
STAGE: CLOSING
Goal: Assumptive small step toward payment or scheduled follow-up.
Rep should:
- Summarize agreed value in one line.
- "${cfg.paymentProcess}" — confirm mobile for link.
- If hesitant: "Want me to text the preview links first, then you tell me yes/no — fair?"
Urgency (soft only): "We batch builds weekly — locking a slot means you're live by [timeline]."
Do NOT: discount unprompted. Do NOT talk past yes.
`,

  wrap: `
STAGE: WRAP-UP
Goal: Confirm next step, warm exit, log outcome mentally.
If yes: confirm number, what they'll see in text, thank them.
If no: thank them, leave door open without pushiness.
If wrong number: apologize, end fast.
`,
  };
}

function objectionQuickRef(cfg: SalesConfig): string {
  return `
OBJECTION QUICK REF (use only the best single line for this moment):
| They say | Rep tries |
| Too much / money | One-time ${cfg.offerPrice} vs one lost job |
| Send email | Text 2 links + price to mobile — faster |
| Have website | "Does it get calls on a phone?" |
| Not interested | Timing vs already covered on Google? |
| Call back | Book 10-min slot or text links now |
`.trim();
}

export function buildMasterSystemPrompt(): string {
  const cfg = getSalesConfig();
  return `
You are an elite real-time cold-call coach for a human sales rep.
${masterOfferBlock(cfg)}

${COMPLIANCE}

COACHING STYLE:
- Output exactly ONE line the rep can say next (max 2 short sentences).
- Conversational, South-Texas-friendly professional — not corporate, not hype.
- Prefer questions that advance the stage over monologues.
- If transcript is unclear, give the best OPENING or DISCOVERY line for this niche.

${objectionQuickRef(cfg)}
`.trim();
}

export function buildStageSection(stage: CallStage): string {
  return stagePlaybook(getSalesConfig())[stage].trim();
}

/** Compact prompt for live coach (OpenRouter) — same SOP rules, less tokens per request. */
export function buildLiveCoachSystemPrompt(stage: CallStage): string {
  const cfg = getSalesConfig();
  return `
Live cold-call coach. Spoken script only — no meta notes (see OUTPUT FORMAT in RULES).
Company (${cfg.companyName}): only when prospect asks — never in opening. Offer: ${cfg.offerSummary} — ${cfg.offerPrice} one-time. ${cfg.targetGeo}.
Opening style: "We help [niche] in [area] build websites for ${cfg.offerPrice}…" then permission question.
${COMPLIANCE}
Stage: ${stageLabel(stage)}
${buildStageSection(stage)}
${objectionQuickRef(cfg)}
`.trim();
}

export function buildLiveCoachContext(input: CoachContextInput): BuiltCoachContext {
  const stage = detectCallStage(input.transcript, input.previousStage);
  const niche = input.niche?.trim() || "local service business";
  const business = input.businessName?.trim() || "this business";
  const websiteNote = input.hasWebsite
    ? "May have weak site — probe mobile + calls."
    : "No website — Google/mobile missed-jobs angle.";

  const systemPrompt = [
    buildLiveCoachSystemPrompt(stage),
    input.playbookContext?.trim()
      ? `Playbook hits:\n${input.playbookContext.trim().slice(0, 500)}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const cfg = getSalesConfig();
  const userPrompt = [
    `Company hold (${cfg.companyName} until asked) · ${stageLabel(stage)} · ${niche} · ${business} · area: ${cfg.targetGeo}. ${websiteNote}`,
    "Transcript:",
    input.transcript.trim().slice(-700),
    "Next line only:",
  ].join("\n");

  return {
    stage,
    stageLabel: stageLabel(stage),
    systemPrompt,
    userPrompt,
  };
}

export function buildCoachContext(input: CoachContextInput): BuiltCoachContext {
  const cfg = getSalesConfig();
  const stage = detectCallStage(input.transcript, input.previousStage);
  const niche = input.niche?.trim() || "local service business";
  const business = input.businessName?.trim() || "this business";
  const websiteNote = input.hasWebsite
    ? "They may have a weak/outdated site — probe mobile + calls."
    : "No website on file — lead with Google/mobile missed jobs angle.";

  const systemPrompt = [
    buildMasterSystemPrompt(),
    buildStageSection(stage),
    input.playbookContext ?? "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const userPrompt = [
    `Call stage (detected): ${stageLabel(stage)}`,
    `Niche: ${niche}`,
    `Business: ${business}`,
    websiteNote,
    "",
    "Recent live transcript (rep + prospect):",
    input.transcript.trim().slice(-900),
    "",
    "Give the rep their very next line only.",
  ].join("\n");

  return {
    stage,
    stageLabel: stageLabel(stage),
    systemPrompt,
    userPrompt,
  };
}

export function buildPostCallSystemPrompt(role: "summarize" | "score" | "playbook"): string {
  const base = buildMasterSystemPrompt();
  if (role === "summarize") {
    return `${base}\n\nTASK: Summarize this call for the rep's CRM. Return JSON only: {"summary":"2-4 sentences: outcome, tone, next step"}`;
  }
  if (role === "score") {
    return `${base}\n\nTASK: Score adherence to the SOP. Return JSON only:
{
  "rep_score": 1-10,
  "objections": ["phrases prospect used"],
  "recommendations": "2-3 specific SOP fixes for next call",
  "opener_suggestion": "one opening line for this niche tomorrow"
}`;
  }
  return `${base}\n\nTASK: Extract one winning objection→response if call was a win. Return JSON only:
{
  "worth_saving": true|false,
  "objection_pattern": "short phrase",
  "winning_response": "what rep said (max 2 sentences)"
}
worth_saving only if outcome Interested/Closed and clear pair exists.`;
}

export function buildDailyAnalystPrompt(): string {
  const cfg = getSalesConfig();
  return `${buildMasterSystemPrompt()}

TASK: Sales ops analyst for team calling ${cfg.targetGeo}.
Given aggregate stats + sample calls, return JSON only:
{
  "headline": "one line",
  "wins_vs_losses": "short comparison",
  "top_objections": ["..."],
  "script_tweaks": ["specific SOP tweak 1", "tweak 2"],
  "focus_niche": "which niche to prioritize tomorrow and why",
  "playbook_candidates": [
    {"niche":"roofing|all","objection_pattern":"...","winning_response":"..."}
  ]
}
Max 3 playbook_candidates.`;
}
