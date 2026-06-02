import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { detectCallStage } from "./call-stage";

describe("detectCallStage", () => {
  it("detects objection on price", () => {
    assert.equal(
      detectCallStage("yeah that's too expensive for us right now"),
      "objection",
    );
  });

  it("detects closing intent", () => {
    assert.equal(
      detectCallStage("ok send me the invoice link on my cell"),
      "closing",
    );
  });

  it("does not regress from closing to opening", () => {
    assert.equal(
      detectCallStage("hi", "closing"),
      "closing",
    );
  });
});
