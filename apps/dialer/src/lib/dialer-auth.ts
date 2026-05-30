export const DIALER_USERNAMES = ["david", "x"] as const;
export type DialerUsername = (typeof DIALER_USERNAMES)[number];

export function isAllowedUsername(value: string): value is DialerUsername {
  return (DIALER_USERNAMES as readonly string[]).includes(
    value.trim().toLowerCase(),
  );
}

export function verifyCredentials(username: string, password: string): boolean {
  const user = username.trim().toLowerCase();
  if (!isAllowedUsername(user)) return false;
  const expected = process.env.DIALER_PASSWORD ?? "Money!";
  return password === expected;
}
