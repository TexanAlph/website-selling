export type CallStage =
  | "opening"
  | "gatekeeper"
  | "discovery"
  | "pitch"
  | "objection"
  | "closing"
  | "wrap";

const STAGE_ORDER: CallStage[] = [
  "opening",
  "gatekeeper",
  "discovery",
  "pitch",
  "objection",
  "closing",
  "wrap",
];

type StageSignals = {
  stage: CallStage;
  patterns: RegExp[];
};

const SIGNALS: StageSignals[] = [
  {
    stage: "wrap",
    patterns: [
      /\b(goodbye|bye|talk later|gotta go)\b/i,
      /\b(have a good (one|day)|take care)\b/i,
    ],
  },
  {
    stage: "closing",
    patterns: [
      /\b(invoice|payment|card|pay|sign up|move forward|let's do it|sounds good|when can you start)\b/i,
      /\b(send (me )?the link|go ahead|i'm in|book it)\b/i,
    ],
  },
  {
    stage: "objection",
    patterns: [
      /\b(too expensive|no budget|not interested|already have|have a (guy|website|web designer))\b/i,
      /\b(send (me )?info|email me|not the decision|call back|busy|who is this|scam)\b/i,
      /\b(don't need|don't want|no thanks|not looking)\b/i,
      /\b(think about it|sleep on it|word of mouth|booked (up|out|solid))\b/i,
      /\b(ask|talk to|check with) (my|the) (wife|husband|spouse|partner|boss)\b/i,
      /\b(waste of money|do it (myself|ourselves)|wix|squarespace|godaddy)\b/i,
      /\b(send (it )?to my email|text me (the )?info)\b/i,
    ],
  },
  {
    stage: "pitch",
    patterns: [
      /\b(599|\$599|website|web site|google|seo|online|customers find you|one.time)\b/i,
      /\b(i build|we build|i make|professional site|mobile friendly)\b/i,
    ],
  },
  {
    stage: "discovery",
    patterns: [
      /\b(how do customers|find you|google|reviews|book jobs|calls|owner|manager)\b/i,
      /\b(do you get|right now|currently|handle leads)\b/i,
    ],
  },
  {
    stage: "gatekeeper",
    patterns: [
      /\b(owner|manager|not here|can i take a message|who's calling|what is this regarding)\b/i,
      /\b(hold on|transfer|let me check)\b/i,
    ],
  },
];

/**
 * Infer call stage from recent transcript (last ~600 chars weighted).
 * Returns stable stage — won't jump backward from closing to opening.
 */
export function detectCallStage(
  transcript: string,
  previousStage?: CallStage,
): CallStage {
  const snippet = transcript.slice(-600).toLowerCase();
  let best: CallStage = "opening";
  let bestScore = 0;

  for (const { stage, patterns } of SIGNALS) {
    let score = 0;
    for (const p of patterns) {
      if (p.test(snippet)) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = stage;
    }
  }

  if (bestScore === 0) {
    return previousStage ?? (transcript.length > 120 ? "discovery" : "opening");
  }

  if (previousStage) {
    const prevIdx = STAGE_ORDER.indexOf(previousStage);
    const nextIdx = STAGE_ORDER.indexOf(best);
    if (nextIdx < prevIdx - 1) {
      return previousStage;
    }
  }

  return best;
}

export function stageLabel(stage: CallStage): string {
  const labels: Record<CallStage, string> = {
    opening: "Opening",
    gatekeeper: "Gatekeeper",
    discovery: "Discovery",
    pitch: "Pitch",
    objection: "Objection",
    closing: "Close",
    wrap: "Wrap-up",
  };
  return labels[stage];
}
