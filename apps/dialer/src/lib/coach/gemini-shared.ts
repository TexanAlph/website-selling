import { GoogleGenerativeAI } from "@google/generative-ai";

function getGeminiClient(
  modelName?: string,
  systemInstruction?: string,
  maxOutputTokens = 160,
) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const name =
    modelName?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: name,
    ...(systemInstruction ? { systemInstruction } : {}),
    generationConfig: { maxOutputTokens, temperature: 0.7 },
  });
}

export async function geminiText(
  modelName: string,
  system: string,
  user: string,
  maxOutputTokens = 600,
): Promise<string> {
  const model = getGeminiClient(modelName, system, maxOutputTokens);
  const result = await model.generateContent(user);
  return result.response.text()?.trim() ?? "";
}

export async function* geminiTextStream(
  modelName: string,
  system: string,
  user: string,
): AsyncGenerator<string> {
  const model = getGeminiClient(modelName, system);
  const result = await model.generateContentStream(user);
  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) yield text;
  }
}

export function parseJsonBlock<T>(raw: string): T | null {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const body = fenced ? fenced[1].trim() : trimmed;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}
