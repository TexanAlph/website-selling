import { getCoachStackConfig, requireLiveLlm } from "./config";
import { liveLlmTextStream, warmCoachLlm } from "./batch-llm";
import { formatPlaybookContext, getPlaybookForNiche } from "./playbook";
import { fetchLeadContext } from "@/lib/calls/sessions";
import { normalizeNiche } from "@/lib/calls/niche";
import type { CallStage } from "./call-stage";
import { parseCounterDisplay } from "./coach-display";
import {
  buildLiveCoachContext,
  buildLiveCoachSystemPrompt,
  type BuiltCoachContext,
} from "./sales-sop";
import { getSalesConfig } from "./sales-config";
import { hasObjectionCue } from "./objection-cues";
import {
  getSessionCoachCache,
  setSessionCoachCache,
} from "./session-cache";
import * as storage from "@/lib/storage/client";

export type CoachStreamInput = {
  sessionId: string;
  leadId?: string | null;
  transcript: string;
  prospectOnly?: string;
  /** Opening line before any speech (keypad / answer). */
  bootstrap?: boolean;
};

async function loadCoachContext(
  sessionId: string,
  leadId: string | null | undefined,
  transcript: string,
  prospectOnly?: string,
): Promise<{
  ctx: BuiltCoachContext;
  stack: ReturnType<typeof getCoachStackConfig>;
  objectionMode: boolean;
}> {
  const stack = getCoachStackConfig();
  const trimmed = transcript.trim();
  const objectionMode = hasObjectionCue(trimmed);

  const cached = getSessionCoachCache(sessionId);
  let niche: string | null = null;
  let businessName: string | null = null;
  let hasWebsite = false;
  let playbookContext = cached?.playbookContext ?? "";

  if (!cached) {
    if (leadId) {
      const lead = await fetchLeadContext(leadId);
      niche = lead?.niche ?? null;
      businessName = lead?.business_name ?? null;
      hasWebsite = Boolean(lead?.website?.trim());
    }
    const playbook = await getPlaybookForNiche(niche);
    playbookContext = formatPlaybookContext(playbook);
    setSessionCoachCache(sessionId, {
      niche,
      businessName,
      hasWebsite,
      playbook,
      playbookContext,
    });
  } else {
    niche = cached.niche;
    businessName = cached.businessName;
    hasWebsite = cached.hasWebsite;
  }

  const priorContent = await storage.getLatestCounterContent(sessionId);
  let previousStage: CallStage | undefined;
  if (priorContent) {
    const { stage } = parseCounterDisplay(priorContent);
    const stages: CallStage[] = [
      "opening",
      "gatekeeper",
      "discovery",
      "pitch",
      "objection",
      "closing",
      "wrap",
    ];
    if (stage && stages.includes(stage as CallStage)) {
      previousStage = stage as CallStage;
    }
  }

  const ctx = buildLiveCoachContext({
    transcript: trimmed,
    prospectOnly: prospectOnly?.trim() || undefined,
    niche,
    businessName,
    hasWebsite,
    playbookContext,
    previousStage: objectionMode ? "objection" : previousStage,
  });

  if (objectionMode) {
    ctx.stage = "objection";
    ctx.systemPrompt = [
      buildLiveCoachSystemPrompt("objection"),
      playbookContext?.trim()
        ? `Playbook:\n${playbookContext.trim().slice(0, 400)}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
    ctx.userPrompt = [
      "Objection — next line only.",
      prospectOnly
        ? `Prospect: ${prospectOnly.slice(-400)}`
        : trimmed.slice(-500),
    ].join("\n");
  }

  return { ctx, stack, objectionMode };
}

export async function* streamCoachPipeline(
  input: CoachStreamInput,
): AsyncGenerator<
  | { type: "token"; text: string }
  | { type: "done"; content: string; stage: string; stageLabel: string }
> {
  const trimmed = input.transcript.trim();
  const bootstrap = Boolean(input.bootstrap);
  if (!trimmed && !input.prospectOnly?.trim() && !bootstrap) {
    throw new Error("Empty transcript");
  }

  const { sessionId, leadId } = input;
  const transcript =
    trimmed ||
    input.prospectOnly ||
    (bootstrap
      ? "[Call connected — prospect has not spoken. Opening only: we help [niche] in [area] build websites for one-time price — do NOT say company name yet; end with permission question.]"
      : "");
  const { ctx } = await loadCoachContext(
    sessionId,
    leadId,
    transcript,
    input.prospectOnly,
  );

  void storage.insertCoachMessage({
    session_id: sessionId,
    lead_id: leadId ?? null,
    role: "transcript",
    content: transcript.slice(-500),
  });

  let full = "";
  const live = requireLiveLlm();
  for await (const token of liveLlmTextStream(
    live,
    ctx.systemPrompt,
    ctx.userPrompt,
    160,
  )) {
    full += token;
    yield { type: "token", text: token };
  }

  const line =
    full.trim() ||
    `We help local businesses in the area get professional websites for one-time ${getSalesConfig().offerPrice} — bad time or thirty seconds?`;
  const counterContent = `[${ctx.stage}] ${line}`;

  await storage.insertCoachMessage({
    session_id: sessionId,
    lead_id: leadId ?? null,
    role: "counter",
    content: counterContent,
  });

  yield {
    type: "done",
    content: counterContent,
    stage: ctx.stage,
    stageLabel: ctx.stageLabel,
  };
}

export async function warmCoachModel(): Promise<void> {
  await warmCoachLlm(requireLiveLlm());
}
