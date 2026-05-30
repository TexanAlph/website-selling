import { getCoachStackConfig } from "./config";
import { generateCounterObjection } from "./gemini";
import { formatPlaybookContext, getPlaybookForNiche } from "./playbook";
import { createServerClient } from "@/lib/supabase/server";
import { fetchLeadContext } from "@/lib/calls/sessions";
import { normalizeNiche } from "@/lib/calls/niche";

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
  const supabase = createServerClient();

  let niche: string | null = null;
  if (leadId) {
    const lead = await fetchLeadContext(leadId);
    niche = lead?.niche ?? null;
  }

  const playbook = await getPlaybookForNiche(niche);
  const playbookContext = formatPlaybookContext(playbook);

  await supabase.from("coach_messages").insert({
    session_id: sessionId,
    lead_id: leadId ?? null,
    role: "transcript",
    content: trimmed.slice(-500),
  });

  const counter = await generateCounterObjection(
    trimmed,
    stack.geminiModel,
    playbookContext,
  );

  const { data, error } = await supabase
    .from("coach_messages")
    .insert({
      session_id: sessionId,
      lead_id: leadId ?? null,
      role: "counter",
      content: counter,
    })
    .select("id, content, created_at, role")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return {
    message: data,
    stack,
    niche: normalizeNiche(niche),
    playbookUsed: playbook.length,
  };
}
