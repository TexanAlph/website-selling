import { normalizeNiche } from "@/lib/calls/niche";
import * as storage from "@/lib/storage/client";

export type PlaybookEntry = {
  objection_pattern: string;
  winning_response: string;
  score: number;
};

export async function getPlaybookForNiche(
  niche: string | null | undefined,
): Promise<PlaybookEntry[]> {
  const key = normalizeNiche(niche);
  const data = await storage.getPlaybookForNiche(
    key === "all" ? "all" : key,
  );
  return data as PlaybookEntry[];
}

export function formatPlaybookContext(entries: PlaybookEntry[]): string {
  if (!entries.length) return "";
  const lines = entries.map(
    (e, i) =>
      `${i + 1}. When they say "${e.objection_pattern}" → try: "${e.winning_response}"`,
  );
  return `\nProven counters from your best calls:\n${lines.join("\n")}`;
}

export async function upsertPlaybookEntry(input: {
  niche: string;
  objectionPattern: string;
  winningResponse: string;
  sourceSessionId?: string | null;
  won: boolean;
}) {
  const niche = normalizeNiche(input.niche);
  await storage.upsertPlaybookEntryApi({
    niche,
    objection_pattern: input.objectionPattern,
    winning_response: input.winningResponse,
    source_session_id: input.sourceSessionId ?? null,
    won: input.won,
  });
}

export async function bumpPlaybookOutcomes(
  niche: string | null,
  outcomeStatus: string | null,
) {
  if (!outcomeStatus) return;
  const key = normalizeNiche(niche);
  await storage.bumpPlaybookOutcomesApi(key, outcomeStatus);
}
