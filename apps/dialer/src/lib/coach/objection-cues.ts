const OBJECTION_PATTERNS = [
  /\btoo expensive\b/i,
  /\bnot interested\b/i,
  /\bno thanks\b/i,
  /\bwho is this\b/i,
  /\balready have\b/i,
  /\bsend (me )?(an )?email\b/i,
  /\bcall me back\b/i,
  /\bnot a good time\b/i,
  /\bscam\b/i,
  /\bdon'?t call\b/i,
];

export function hasObjectionCue(text: string): boolean {
  const t = text.slice(-400);
  return OBJECTION_PATTERNS.some((p) => p.test(t));
}
