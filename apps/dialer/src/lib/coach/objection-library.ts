import type { CallStage } from "./call-stage";

/**
 * Curated objection→counter library for the one-time website cold call.
 * Env-free and client-safe: counters take vars so the browser bundle never
 * touches process.env (sales config stays server-side).
 *
 * This is the coach's day-one knowledge — the learned playbook
 * (playbook.ts) layers niche-specific wins on top of it.
 */

export type ObjectionVars = {
  price: string;
  companyName: string;
  deliveryTimeline: string;
};

export type ObjectionDef = {
  id: string;
  /** Short prospect-voice phrase for "If they say…" hints. */
  label: string;
  patterns: RegExp[];
  counter: (v: ObjectionVars) => string;
};

export const OBJECTION_LIBRARY: ObjectionDef[] = [
  {
    id: "price",
    label: "too expensive",
    patterns: [
      /\btoo (expensive|much|pricey|high)\b/i,
      /\b(can'?t|cannot) afford\b/i,
      /\bno budget\b/i,
      /\bmoney('?s| is)? tight\b/i,
      /\bcheaper\b/i,
      /\bthat much\b/i,
    ],
    counter: (v) =>
      `Totally fair — it's ${v.price} once, not $150 a month forever. What's one missed job worth to you?`,
  },
  {
    id: "have-website",
    label: "already have a website",
    patterns: [
      /\b(already|we) (have|got) a (web)?site\b/i,
      /\bour (web)?site\b/i,
      /\bhave a website\b/i,
    ],
    counter: () =>
      `That's great — when somebody pulls it up on their phone, does it look sharp and make them call? If not, that's all we fix.`,
  },
  {
    id: "have-guy",
    label: "have a guy for that",
    patterns: [
      /\bhave a (guy|girl|person|web ?designer)\b/i,
      /\bmy (nephew|niece|son|daughter|cousin|buddy|friend) (does|did|made|built|handles)\b/i,
      /\bsomebody (does|handles) that\b/i,
    ],
    counter: () =>
      `Love that — is it actually bringing in calls, or more of a brochure? Worth a quick second look if Google isn't sending you work.`,
  },
  {
    id: "send-info",
    label: "send me an email",
    patterns: [
      /\bsend (me )?(an )?(email|info|information|something)\b/i,
      /\bemail (me|it)\b/i,
      /\bput (it|that) in writing\b/i,
      /\bmail (me )?something\b/i,
    ],
    counter: () =>
      `Happy to — I'll text two example sites plus the price so it doesn't get buried in your inbox. What's the best mobile number?`,
  },
  {
    id: "not-interested",
    label: "not interested",
    patterns: [
      /\bnot interested\b/i,
      /\bno thanks?\b/i,
      /\bdon'?t (need|want) (one|it|that|a website)\b/i,
      /\bnot looking\b/i,
      /\bwe'?re good\b/i,
    ],
    counter: () =>
      `No worries — quick honest question though: is it bad timing, or do you feel covered when folks Google you?`,
  },
  {
    id: "busy",
    label: "I'm busy right now",
    patterns: [
      /\b(i'?m|we'?re|real|too) busy\b/i,
      /\bin the middle of\b/i,
      /\bbad time\b/i,
      /\bcan'?t talk\b/i,
      /\bon a job\b/i,
      /\bnot a good time\b/i,
    ],
    counter: () =>
      `Totally get it — twenty seconds: one-time website, no monthly fees. Want me to try you tomorrow morning instead?`,
  },
  {
    id: "who-is-this",
    label: "who is this?",
    patterns: [
      /\bwho('?s| is) (this|calling)\b/i,
      /\bwhat company\b/i,
      /\bwhere (are )?you calling from\b/i,
      /\bwhat('?s| is) this (about|regarding)\b/i,
    ],
    counter: (v) =>
      `${v.companyName} — local team, we build one-time websites for ${v.price}. Happy to text a couple of examples so you know it's real.`,
  },
  {
    id: "scam",
    label: "sounds like a scam",
    patterns: [
      /\bscam(mer)?\b/i,
      /\bspam\b/i,
      /\btelemarket(er|ing)\b/i,
      /\brobo ?call\b/i,
      /\bhow('?d| did) you get (my|this) number\b/i,
    ],
    counter: (v) =>
      `Fair to ask — we're ${v.companyName}, local, with references you can check. I'll text proof links first, no payment talk until you've seen them.`,
  },
  {
    id: "think-about-it",
    label: "let me think about it",
    patterns: [
      /\bthink (about it|it over|on it)\b/i,
      /\blet me think\b/i,
      /\bsleep on it\b/i,
      /\bget back to you\b/i,
    ],
    counter: () =>
      `Of course — what's the one thing you'd be weighing? Usually I can answer it in ten seconds right now.`,
  },
  {
    id: "spouse-partner",
    label: "need to ask my wife/partner",
    patterns: [
      /\b(ask|talk to|check with) (my|the) (wife|husband|spouse|partner|boss)\b/i,
      /\bbusiness partner\b/i,
      /\bwe decide together\b/i,
    ],
    counter: () =>
      `Smart — want me to text the example links so you two can look at them together tonight? Then it's an easy yes or no.`,
  },
  {
    id: "word-of-mouth",
    label: "all my work is word of mouth",
    patterns: [
      /\bword of mouth\b/i,
      /\breferrals?\b/i,
      /\ball the (work|business) (i|we) (need|can handle)\b/i,
      /\bbooked (up|out|solid)\b/i,
      /\bdon'?t need more (work|jobs|business)\b/i,
    ],
    counter: () =>
      `That's the best kind — but even referrals Google you before they call. A simple site just makes sure you pass that check.`,
  },
  {
    id: "facebook-only",
    label: "we just use Facebook",
    patterns: [
      /\b(have|got|use|on) (a )?facebook\b/i,
      /\binstagram\b/i,
      /\bsocial media('?s| is)? (enough|fine|all we)\b/i,
    ],
    counter: () =>
      `Facebook's great for regulars — but new customers Google first, and a page login wall loses them. The site catches the ones Facebook misses.`,
  },
  {
    id: "google-maps-only",
    label: "we're already on Google",
    patterns: [
      /\b(already )?on google( maps)?\b/i,
      /\bgoogle (business|listing|profile)\b/i,
      /\bpeople find us on google\b/i,
    ],
    counter: () =>
      `Maps gets you found — the website is what makes them pick you over the next listing instead of bouncing.`,
  },
  {
    id: "call-back",
    label: "call me back later",
    patterns: [
      /\bcall (me )?back\b/i,
      /\btry (me|us) (later|again|tomorrow|next week)\b/i,
      /\banother time\b/i,
    ],
    counter: () =>
      `Sure — morning or afternoon better? And I'll text the two example links now so the callback's quick.`,
  },
  {
    id: "bad-experience",
    label: "tried a website before, waste of money",
    patterns: [
      /\b(tried|had|did) (that|a website|one) before\b/i,
      /\bwaste of money\b/i,
      /\bdidn'?t (work|do anything|get (me|us) anything)\b/i,
      /\bgot burned\b/i,
    ],
    counter: (v) =>
      `Sounds like you paid monthly for something that just sat there — this is ${v.price} once, you approve it before it goes live, and you own it.`,
  },
  {
    id: "diy",
    label: "I'll just do it myself",
    patterns: [
      /\bdo it (myself|ourselves)\b/i,
      /\bwix\b/i,
      /\bsquarespace\b/i,
      /\bgodaddy\b/i,
      /\bbuild (it|one) myself\b/i,
    ],
    counter: (v) =>
      `You could — most owners start one and it sits half-done for a year. ${v.price} once and it's live in ${v.deliveryTimeline} while you run the business.`,
  },
  {
    id: "remove-me",
    label: "take me off your list",
    patterns: [
      /\btake (me|us) off\b/i,
      /\b(don'?t|do not|stop) call(ing)?\b/i,
      /\bremove (me|us|my number)\b/i,
      /\bdo.not.call\b/i,
    ],
    counter: () =>
      `Absolutely — I apologize for the interruption, you're off our list right now. Have a good one.`,
  },
];

const byId = new Map(OBJECTION_LIBRARY.map((d) => [d.id, d]));

export function getObjectionDef(id: string): ObjectionDef | undefined {
  return byId.get(id);
}

export function hasObjectionCue(text: string): boolean {
  const t = text.slice(-400);
  return OBJECTION_LIBRARY.some((d) => d.patterns.some((p) => p.test(t)));
}

/**
 * Objections in the most recent speech, ordered most-recent first
 * (by where the match starts in the tail).
 */
export function matchObjections(text: string, max = 2): ObjectionDef[] {
  const tail = text.slice(-450);
  const hits: Array<{ def: ObjectionDef; at: number }> = [];
  for (const def of OBJECTION_LIBRARY) {
    let at = -1;
    for (const p of def.patterns) {
      const idx = tail.search(p);
      if (idx > at) at = idx;
    }
    if (at >= 0) hits.push({ def, at });
  }
  hits.sort((a, b) => b.at - a.at);
  return hits.slice(0, max).map((h) => h.def);
}

/** Every objection raised anywhere in the call so far. */
export function seenObjectionIds(fullTranscript: string): string[] {
  return OBJECTION_LIBRARY.filter((d) =>
    d.patterns.some((p) => p.test(fullTranscript)),
  ).map((d) => d.id);
}

/** Which objections to expect next, per stage — drives "If they say…" hints. */
const ANTICIPATE: Record<CallStage, string[]> = {
  opening: ["busy", "who-is-this", "not-interested"],
  gatekeeper: ["send-info", "call-back", "who-is-this"],
  discovery: ["have-guy", "have-website", "word-of-mouth"],
  pitch: ["price", "think-about-it", "have-guy"],
  objection: ["price", "send-info", "think-about-it"],
  closing: ["think-about-it", "spouse-partner", "price"],
  wrap: [],
};

export function anticipateObjections(
  stage: CallStage,
  seenIds: string[],
  vars: ObjectionVars,
  max = 2,
): Array<{ label: string; line: string }> {
  const seen = new Set(seenIds);
  return ANTICIPATE[stage]
    .filter((id) => !seen.has(id))
    .slice(0, max)
    .map((id) => {
      const def = byId.get(id)!;
      return { label: def.label, line: def.counter(vars) };
    });
}
