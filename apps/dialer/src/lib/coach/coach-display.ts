/** Strip coach meta-notes from LLM output — rep only sees speakable script. */
export function sanitizeSayNow(raw: string): string {
  let text = raw.trim();
  if (!text) return text;

  // Drop *coach note: ...* blocks (common LLM habit)
  text = text.replace(
    /\*?\s*coach\s*note\s*:\s*[\s\S]*?(?=\*|$)/gi,
    "",
  );
  text = text.replace(/\([^)]*coach\s*note[^)]*\)/gi, "");
  text = text.replace(/\*coach\s*note[\s\S]*?\*/gi, "");

  // If a coach-note prefix ate the opening, split on it
  const noteSplit = text.split(/\*?\s*coach\s*note\s*:/i);
  if (noteSplit[0]?.trim()) {
    text = noteSplit[0].trim();
  }

  text = text.replace(/\*+/g, "").replace(/\s{2,}/g, " ").trim();

  const lower = text.toLowerCase();
  const isMostlyWaitMeta =
    lower.includes("wait for response") &&
    (lower.includes("pitch structure") ||
      lower.includes("objection handling") ||
      lower.includes("if yes") ||
      lower.includes("if no") ||
      text.length > 60);

  if (isMostlyWaitMeta || /^wait for (their )?response\.?$/i.test(text)) {
    return "Wait for their answer.";
  }

  return text || "Wait for their answer.";
}

/** Strip [stage] prefix from stored counter lines for UI display. */
export function parseCounterDisplay(content: string): {
  stage: string | null;
  text: string;
} {
  const match = content.match(/^\[([a-z]+)\]\s*([\s\S]*)$/i);
  if (!match) {
    return { stage: null, text: sanitizeSayNow(content) };
  }
  return {
    stage: match[1],
    text: sanitizeSayNow(match[2].trim() || content),
  };
}
