import { GoogleGenerativeAI } from "@google/generative-ai";
import type { LlmProvider } from "./types";

export type LlmCallConfig = {
  provider: LlmProvider;
  model: string;
};

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

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

function geminiClient(
  modelName: string,
  systemInstruction?: string,
  maxOutputTokens = 600,
) {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  return new GoogleGenerativeAI(apiKey).getGenerativeModel({
    model: modelName,
    ...(systemInstruction ? { systemInstruction } : {}),
    generationConfig: { maxOutputTokens, temperature: 0.7 },
  });
}

async function openRouterChat(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER?.trim() || "",
      "X-Title": "Web Dialer Coach",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
    }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content?.trim() ?? "";
}

async function* openRouterChatStream(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): AsyncGenerator<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not configured");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER?.trim() || "",
      "X-Title": "Web Dialer Coach",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      max_tokens: maxTokens,
      temperature: 0.7,
      stream: true,
    }),
  });

  if (!res.ok || !res.body) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`OpenRouter ${res.status}: ${err.slice(0, 200)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed.startsWith("data:")) continue;
      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const parsed = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const piece = parsed.choices?.[0]?.delta?.content;
        if (piece) yield piece;
      } catch {
        /* skip malformed SSE chunk */
      }
    }
  }
}

export async function llmText(
  cfg: LlmCallConfig,
  system: string,
  user: string,
  maxOutputTokens = 600,
): Promise<string> {
  if (cfg.provider === "gemini") {
    const model = geminiClient(cfg.model, system, maxOutputTokens);
    const result = await model.generateContent(user);
    return result.response.text()?.trim() ?? "";
  }
  return openRouterChat(cfg.model, system, user, maxOutputTokens);
}

export async function* llmTextStream(
  cfg: LlmCallConfig,
  system: string,
  user: string,
  maxOutputTokens = 160,
): AsyncGenerator<string> {
  if (cfg.provider === "gemini") {
    const model = geminiClient(cfg.model, system, maxOutputTokens);
    const result = await model.generateContentStream(user);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
    return;
  }
  yield* openRouterChatStream(cfg.model, system, user, maxOutputTokens);
}
