/** Strip [stage] prefix from stored counter lines for UI display. */
export function parseCounterDisplay(content: string): {
  stage: string | null;
  text: string;
} {
  const match = content.match(/^\[([a-z]+)\]\s*([\s\S]*)$/i);
  if (!match) return { stage: null, text: content };
  return { stage: match[1], text: match[2].trim() || content };
}
