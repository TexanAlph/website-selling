import { getCoachStackConfig } from "./config";
import { geminiTextStream } from "./gemini-shared";
import { formatPlaybookContext, getPlaybookForNiche } from "./playbook";
import { createServerClient } from "@/lib/supabase/server";
import { fetchLeadContext } from "@/lib/calls/sessions";
import { normalizeNiche } from "@/lib/calls/niche";
import type { CallStage } from "./call-stage";
import { parseCounterDisplay } from "./coach-display";
import {
  buildCoachContext,
  buildMasterSystemPrompt,
  type CoachContextInput,
} from "./sales-sop";
import { hasObjectionCue } from "./objection-cues";
import {
  getSessionCoachCache,
  setSessionCoachCache,
} from "./session-cache";

export type CoachStreamInput = {
  sessionId: string;
  leadId?: string | null;
  transcript: string;
  prospectOnly?: string;
};

async function loadCoachContext(
  sessionId: string,
  leadId: string | null | undefined,
  transcript: string,
  prospectOnly?: string,
): Promise<{
  ctx: ReturnType<typeof buildCoachContext>;
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
    const supabase = createServerClient();
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

  const supabase = createServerClient();
  const { data: priorCounters } = await supabase
    .from("coach_messages")
    .select("content")
    .eq("session_id", sessionId)
    .eq("role", "counter")
    .order("created_at", { ascending: false })
    .limit(1);

  let previousStage: CallStage | undefined;
  if (priorCounters?.[0]?.content) {
    const { stage } = parseCounterDisplay(priorCounters[0].content);
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

  const coachInput: CoachContextInput = {
    transcript: trimmed,
    niche,
    businessName,
    hasWebsite,
    playbookContext,
    previousStage: objectionMode ? "objection" : previousStage,
  };

  if (objectionMode) {
    coachInput.previousStage = "objection";
  }

  const ctx = buildCoachContext(coachInput);
  if (objectionMode) {
    ctx.stage = "objection";
    ctx.systemPrompt = [
      buildMasterSystemPrompt(),
      "STAGE: OBJECTION — respond in ONE short line the rep says next. Max 2 sentences. Calm, local, no hype.",
      playbookContext,
    ]
      .filter(Boolean)
      .join("\n\n");
    ctx.userPrompt = [
      "Prospect just objected. Give the rep their next line only.",
      prospectOnly
        ? `Prospect said: ${prospectOnly.slice(-400)}`
        : `Context: ${trimmed.slice(-500)}`,
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
  if (!trimmed && !input.prospectOnly?.trim()) {
    throw new Error("Empty transcript");
  }

  const { sessionId, leadId } = input;
  const transcript = trimmed || input.prospectOnly || "";
  const { ctx, stack } = await loadCoachContext(
    sessionId,
    leadId,
    transcript,
    input.prospectOnly,
  );

  const supabase = createServerClient();
  void supabase.from("coach_messages").insert({
    session_id: sessionId,
    lead_id: leadId ?? null,
    role: "transcript",
    content: transcript.slice(-500),
  });

  let full = "";
  for await (const token of geminiTextStream(
    stack.geminiModel,
    ctx.systemPrompt,
    ctx.userPrompt,
  )) {
    full += token;
    yield { type: "token", text: token };
  }

  const line =
    full.trim() ||
    "Quick question — when locals Google your service, do they find you first or the next company?";
  const counterContent = `[${ctx.stage}] ${line}`;

  const { data, error } = await supabase
    .from("coach_messages")
    .insert({
      session_id: sessionId,
      lead_id: leadId ?? null,
      role: "counter",
      content: counterContent,
    })
    .select("id, content, created_at, role")
    .single();

  if (error) throw new Error(error.message);

  yield {
    type: "done",
    content: counterContent,
    stage: ctx.stage,
    stageLabel: ctx.stageLabel,
  };
}

export async function warmCoachModel(): Promise<void> {
  const stack = getCoachStackConfig();
  const { geminiText } = await import("./gemini-shared");
  await geminiText(stack.geminiModel, "Reply with OK only.", "OK");
}
