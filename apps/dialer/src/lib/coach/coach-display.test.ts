import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseCounterDisplay, sanitizeSayNow } from "./coach-display";

describe("sanitizeSayNow", () => {
  it("strips verbose coach notes and keeps spoken line", () => {
    const raw =
      "We help plumbers in San Antonio get websites for $599 — bad time or thirty seconds? *coach note: wait for response - if yes proceed to pitch structure if no use objection handling.*";
    assert.equal(
      sanitizeSayNow(raw),
      "We help plumbers in San Antonio get websites for $599 — bad time or thirty seconds?",
    );
  });

  it("collapses wait-only meta to short line", () => {
    assert.equal(
      sanitizeSayNow(
        "coach note: wait for response - if yes proceed to pitch structure if no use objection handling",
      ),
      "Wait for their answer.",
    );
  });
});

describe("parseCounterDisplay", () => {
  it("sanitizes counter body", () => {
    const { stage, text } = parseCounterDisplay(
      "[opening] Hi there — worth thirty seconds? *coach note: wait for response*",
    );
    assert.equal(stage, "opening");
    assert.equal(text, "Hi there — worth thirty seconds?");
  });
});
