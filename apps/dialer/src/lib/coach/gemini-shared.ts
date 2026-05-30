import { GoogleGenerativeAI } from "@google/generative-ai";

export function getGeminiModel(modelName?: string) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  const name =
    modelName?.trim() || process.env.GEMINI_MODEL?.trim() || "gemini-2.0-flash";
  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({ model: name });
}

export async function geminiText(
  modelName: string,
  system: string,
  user: string,
): Promise<string> {
  const model = getGeminiModel(modelName);
  const result = await model.generateContent([
    { text: system },
    { text: user },
  ]);
  return result.response.text()?.trim() ?? "";
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
