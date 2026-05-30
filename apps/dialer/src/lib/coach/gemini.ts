import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM = `You are a real-time sales coach for a web design cold call ($599 one-time sites).
The rep sells websites to local businesses with no/missing sites.
Reply with ONE short counter-objection (max 2 sentences) the rep can say next.
Be direct, conversational, never robotic. If no objection detected, say "Keep probing for pain around Google visibility."`;

export async function generateCounterObjection(
  transcript: string,
  modelName: string,
): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelName });

  const result = await model.generateContent([
    { text: SYSTEM },
    { text: `Live transcript snippet:\n${transcript.trim()}` },
  ]);

  return (
    result.response.text()?.trim() ||
    "Acknowledge their concern, then ask one clarifying question."
  );
}
