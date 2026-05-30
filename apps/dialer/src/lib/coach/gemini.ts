import { geminiText } from "./gemini-shared";

const SYSTEM_BASE = `You are a real-time sales coach for a web design cold call ($599 one-time sites).
The rep sells websites to local businesses with no/missing sites.
Reply with ONE short counter-objection (max 2 sentences) the rep can say next.
Be direct, conversational, never robotic. If no objection detected, say "Keep probing for pain around Google visibility."`;

export async function generateCounterObjection(
  transcript: string,
  modelName: string,
  playbookContext = "",
): Promise<string> {
  const system = playbookContext
    ? `${SYSTEM_BASE}${playbookContext}`
    : SYSTEM_BASE;

  const text = await geminiText(
    modelName,
    system,
    `Live transcript snippet:\n${transcript.trim()}`,
  );

  return (
    text ||
    "Acknowledge their concern, then ask one clarifying question."
  );
}
