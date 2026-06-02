export function hapticLight() {
  try {
    navigator.vibrate?.(8);
  } catch {
    /* unsupported */
  }
}

export function hapticSuccess() {
  try {
    navigator.vibrate?.([12, 40, 12]);
  } catch {
    /* unsupported */
  }
}

export function hapticOutcome(kind: "wrong" | "not_interested" | "interested") {
  if (kind === "interested") hapticSuccess();
  else hapticLight();
}
