export const DIALER_USERNAMES = ["david", "roslyn"] as const;
export type DialerUsername = (typeof DIALER_USERNAMES)[number];

/** Legacy scraper rows may still use assigned_rep = "x". */
export function normalizeRepId(value: string): string {
  const v = value.trim().toLowerCase();
  if (v === "x") return "roslyn";
  return v;
}

export function isAllowedUsername(value: string): value is DialerUsername {
  return (DIALER_USERNAMES as readonly string[]).includes(
    normalizeRepId(value) as DialerUsername,
  );
}

export function verifyCredentials(username: string, password: string): boolean {
  const user = normalizeRepId(username);
  if (!isAllowedUsername(user)) return false;
  const expected = process.env.DIALER_PASSWORD ?? "Money!";
  return password === expected;
}
