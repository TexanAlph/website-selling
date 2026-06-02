import type { PlaybookEntry } from "./playbook";

type CachedSession = {
  niche: string | null;
  businessName: string | null;
  hasWebsite: boolean;
  playbook: PlaybookEntry[];
  playbookContext: string;
  expiresAt: number;
};

const TTL_MS = 45 * 60 * 1000;
const cache = new Map<string, CachedSession>();

export function getSessionCoachCache(sessionId: string): CachedSession | null {
  const row = cache.get(sessionId);
  if (!row) return null;
  if (Date.now() > row.expiresAt) {
    cache.delete(sessionId);
    return null;
  }
  return row;
}

export function setSessionCoachCache(
  sessionId: string,
  data: Omit<CachedSession, "expiresAt">,
): void {
  cache.set(sessionId, { ...data, expiresAt: Date.now() + TTL_MS });
}

export function clearSessionCoachCache(sessionId: string): void {
  cache.delete(sessionId);
}
