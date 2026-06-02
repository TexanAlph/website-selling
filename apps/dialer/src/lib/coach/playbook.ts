import { createServerClient } from "@/lib/supabase/server";
import { normalizeNiche } from "@/lib/calls/niche";

export type PlaybookEntry = {
  objection_pattern: string;
  winning_response: string;
  score: number;
};

export async function getPlaybookForNiche(
  niche: string | null | undefined,
): Promise<PlaybookEntry[]> {
  const supabase = createServerClient();
  const key = normalizeNiche(niche);

  const niches =
    key === "all" ? ["all"] : [key, "all"];

  const { data, error } = await supabase
    .from("playbook_entries")
    .select("objection_pattern, winning_response, score")
    .in("niche", niches)
    .order("score", { ascending: false })
    .limit(6);

  if (error || !data?.length) return [];
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
  const supabase = createServerClient();
  const niche = normalizeNiche(input.niche);
  const winDelta = input.won ? 1 : 0;
  const lossDelta = input.won ? 0 : 1;

  const { data: existing } = await supabase
    .from("playbook_entries")
    .select("id, win_count, loss_count, score")
    .eq("niche", niche)
    .eq("objection_pattern", input.objectionPattern)
    .maybeSingle();

  if (existing) {
    const wins = (existing.win_count ?? 0) + winDelta;
    const losses = (existing.loss_count ?? 0) + lossDelta;
    const score = wins / Math.max(1, wins + losses);
    await supabase
      .from("playbook_entries")
      .update({
        winning_response: input.winningResponse,
        win_count: wins,
        loss_count: losses,
        score,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id);
    return;
  }

  const score = input.won ? 1 : 0;
  await supabase.from("playbook_entries").insert({
    niche,
    objection_pattern: input.objectionPattern,
    winning_response: input.winningResponse,
    source_session_id: input.sourceSessionId ?? null,
    win_count: winDelta,
    loss_count: lossDelta,
    score,
  });
}

export async function bumpPlaybookOutcomes(
  niche: string | null,
  outcomeStatus: string | null,
) {
  if (!outcomeStatus) return;
  const supabase = createServerClient();
  const key = normalizeNiche(niche);
  const won = outcomeStatus === "Interested/Closed";

  const { data: entries } = await supabase
    .from("playbook_entries")
    .select("id, win_count, loss_count")
    .in("niche", key === "all" ? ["all"] : [key, "all"])
    .order("score", { ascending: false })
    .limit(3);

  if (!entries?.length) return;

  for (const row of entries) {
    const wins = (row.win_count ?? 0) + (won ? 1 : 0);
    const losses = (row.loss_count ?? 0) + (won ? 0 : 1);
    await supabase
      .from("playbook_entries")
      .update({
        win_count: wins,
        loss_count: losses,
        score: wins / Math.max(1, wins + losses),
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }
}
