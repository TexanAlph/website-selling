/** FastAPI 404 / stale Mac Mini API — treat as empty history, not a broken UI. */
export function isHistoryUnavailable(message: string): boolean {
  const m = message.toLowerCase().trim();
  return (
    m === "not found" ||
    m.includes("404") ||
    m.startsWith("storage api 404")
  );
}

export async function readFetchError(res: Response): Promise<string> {
  try {
    const json = (await res.json()) as { error?: string; detail?: string };
    return json.error ?? json.detail ?? res.statusText ?? "Request failed";
  } catch {
    return res.statusText || "Request failed";
  }
}
