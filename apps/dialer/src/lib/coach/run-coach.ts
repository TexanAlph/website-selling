import { getCoachStackConfig } from "./config";
import { generateCoachLine } from "./gemini";
import { formatPlaybookContext, getPlaybookForNiche } from "./playbook";
import { fetchLeadContext } from "@/lib/calls/sessions";
import { normalizeNiche } from "@/lib/calls/niche";
import type { CallStage } from "./call-stage";
import { parseCounterDisplay } from "./coach-display";
import * as storage from "@/lib/storage/client";

export type CoachRunInput = {
  sessionId: string;
  leadId?: string | null;
  transcript: string;
};

export async function runCoachPipeline(input: CoachRunInput) {
  const { sessionId, leadId, transcript } = input;
  const trimmed = transcript.trim();
  if (!trimmed) {
    throw new Error("Empty transcript");
  }

  const stack = getCoachStackConfig();

  let niche: string | null = null;
  let businessName: string | null = null;
  let hasWebsite = false;

  if (leadId) {
    const lead = await fetchLeadContext(leadId);
    niche = lead?.niche ?? null;
    businessName = lead?.business_name ?? null;
    hasWebsite = Boolean(lead?.website?.trim());
  }

  const playbook = await getPlaybookForNiche(niche);
  const playbookContext = formatPlaybookContext(playbook);

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

  await storage.insertCoachMessage({
    session_id: sessionId,
    lead_id: leadId ?? null,
    role: "transcript",
    content: trimmed.slice(-500),
  });

  const coached = await generateCoachLine(
    {
      transcript: trimmed,
      niche,
      businessName,
      hasWebsite,
      playbookContext,
      previousStage,
    },
    stack.geminiModel,
  );

  const counterContent = `[${coached.stage}] ${coached.line}`;

  const data = await storage.insertCoachMessage({
    session_id: sessionId,
    lead_id: leadId ?? null,
    role: "counter",
    content: counterContent,
  });

  return {
    message: data,
    stack,
    niche: normalizeNiche(niche),
    playbookUsed: playbook.length,
    stage: coached.stage,
    stageLabel: coached.stageLabel,
  };
}
