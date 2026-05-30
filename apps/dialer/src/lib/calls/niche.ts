/** Normalize niche for playbook lookup (lowercase, collapsed whitespace). */
export function normalizeNiche(raw: string | null | undefined): string {
  if (!raw?.trim()) return "all";
  return raw.trim().toLowerCase().replace(/\s+/g, " ");
}
