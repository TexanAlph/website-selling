/** Format up to 10 US digits for display: (210) 555-1234 */
export function formatDialDisplay(digits: string): string {
  const d = digits.replace(/\D/g, "").slice(0, 15);
  if (d.length === 0) return "";
  if (d.length <= 3) return d;
  if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  if (d.length <= 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return `+${d.slice(0, d.length - 10)} (${d.slice(-10, -7)}) ${d.slice(-7, -4)}-${d.slice(-4)}`;
}

export function toOutboundE164(digits: string): string | null {
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length >= 10 && d.length <= 15) return `+${d}`;
  return null;
}

/** Normalize Twilio/inbound numbers like +12105551234 for outbound dial. */
export function phoneToE164(phone: string): string | null {
  const trimmed = phone.trim();
  if (trimmed.startsWith("+")) {
    const d = trimmed.replace(/\D/g, "");
    if (d.length >= 10 && d.length <= 15) return `+${d}`;
  }
  return toOutboundE164(trimmed);
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}
