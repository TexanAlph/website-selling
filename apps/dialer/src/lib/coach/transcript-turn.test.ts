import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildCoachTranscriptFromLines,
  coachTranscriptFingerprint,
} from "./transcript-turn";

describe("buildCoachTranscriptFromLines", () => {
  it("builds labeled dialog and prospect-only text", () => {
    const { transcript, prospectOnly } = buildCoachTranscriptFromLines([
      { speaker: "rep", text: "Hi, quick question" },
      { speaker: "prospect", text: "We are busy" },
    ]);
    assert.equal(prospectOnly, "We are busy");
    assert.match(transcript, /You: Hi/);
    assert.match(transcript, /Prospect: We are busy/);
  });
});

describe("coachTranscriptFingerprint", () => {
  it("prefers prospect slice when present", () => {
    const a = coachTranscriptFingerprint("full", "new words");
    const b = coachTranscriptFingerprint("full", "new words");
    const c = coachTranscriptFingerprint("full", "other");
    assert.equal(a, b);
    assert.notEqual(a, c);
  });
});
