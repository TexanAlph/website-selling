import { geminiText } from "./gemini-shared";
import {
  buildCoachContext,
  type BuiltCoachContext,
  type CoachContextInput,
} from "./sales-sop";

export type { BuiltCoachContext, CoachContextInput };

export async function generateCoachLine(
  input: CoachContextInput,
  modelName: string,
): Promise<BuiltCoachContext & { line: string }> {
  const ctx = buildCoachContext(input);

  const text = await geminiText(modelName, ctx.systemPrompt, ctx.userPrompt);

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
  modelName: string,
  playbookContext = "",
): Promise<string> {
  const result = await generateCoachLine(
    { transcript, playbookContext },
    modelName,
  );
  return result.line;
}
