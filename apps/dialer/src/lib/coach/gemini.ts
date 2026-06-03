import { llmText } from "./llm-client";
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

  const text = await llmText(live, ctx.systemPrompt, ctx.userPrompt, 160);

  return {
    ...ctx,
    line:
      text ||
      "Quick question — when locals Google your service, do they find you first or the next company?",
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
