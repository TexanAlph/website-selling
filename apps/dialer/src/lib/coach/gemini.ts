import { batchLlmText } from "./batch-llm";
import { requireLiveLlm } from "./config";
import {
  buildLiveCoachContext,
  type BuiltCoachContext,
  type CoachContextInput,
} from "./sales-sop";

export type { BuiltCoachContext, CoachContextInput };

export async function generateCoachLine(
  input: CoachContextInput,
): Promise<BuiltCoachContext & { line: string }> {
  const ctx = buildLiveCoachContext(input);
  const live = requireLiveLlm();

  const text = await batchLlmText(live, ctx.systemPrompt, ctx.userPrompt, 160);

  return {
    ...ctx,
    line:
      text ||
      "We help local businesses get professional websites for a one-time $599 — bad time or thirty seconds?",
  };
}

/** @deprecated Use generateCoachLine */
export async function generateCounterObjection(
  transcript: string,
  playbookContext = "",
): Promise<string> {
  const result = await generateCoachLine({ transcript, playbookContext });
  return result.line;
}
