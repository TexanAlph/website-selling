import { createClient } from "@supabase/supabase-js";
import { getCoachStackConfig } from "./config";
import { generateCounterObjection } from "./gemini";

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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error("Supabase server credentials not configured");
  }

  const stack = getCoachStackConfig();
  const supabase = createClient(supabaseUrl, serviceKey);

  await supabase.from("coach_messages").insert({
    session_id: sessionId,
    lead_id: leadId ?? null,
    role: "transcript",
    content: trimmed.slice(-500),
  });

  const counter = await generateCounterObjection(trimmed, stack.geminiModel);

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

  return { message: data, stack };
}
