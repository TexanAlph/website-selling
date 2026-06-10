/**
 * Who's-who guard for mixed (Safari speech) transcripts.
 *
 * Safari WebSpeech hears both sides as one stream, so the rep reading a
 * coach line ("…is it timing or not interested?") can look like a prospect
 * objection. We know exactly what the coach told the rep to say — sentences
 * that heavily overlap a recent coach line are almost certainly the rep
 * talking, so they're excluded before objection matching.
 *
 * Media Streams transcripts are already split by leg and skip this.
 */

const MIN_SENTENCE_WORDS = 3;
const OVERLAP_THRESHOLD = 0.7;

function normalizeWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 1);
}

export function isLikelyRepEcho(
  sentence: string,
  coachLines: string[],
): boolean {
  const words = normalizeWords(sentence);
  if (words.length < MIN_SENTENCE_WORDS) return false;
  for (const line of coachLines) {
    const lineWords = new Set(normalizeWords(line));
    if (lineWords.size < MIN_SENTENCE_WORDS) continue;
    const hits = words.filter((w) => lineWords.has(w)).length;
    if (hits / words.length >= OVERLAP_THRESHOLD) return true;
  }
  return false;
}

/** Drop sentences that echo recent coach suggestions (rep speaking). */
export function filterRepEcho(text: string, coachLines: string[]): string {
  if (!coachLines.length || !text.trim()) return text;
  const sentences = text.split(/(?<=[.!?])\s+|\n+/);
  return sentences
    .filter((s) => !isLikelyRepEcho(s, coachLines))
    .join(" ")
    .trim();
}
