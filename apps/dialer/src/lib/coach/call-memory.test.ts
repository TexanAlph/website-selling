import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildCallMemory, formatMemoryContext } from "./call-memory";
import { filterRepEcho } from "./rep-echo";

describe("buildCallMemory", () => {
  it("tracks objections from the full transcript", () => {
    const memory = buildCallMemory(
      "hello ... that's too expensive ... well let me think about it",
      [],
    );
    assert.ok(memory.objectionIds.includes("price"));
    assert.ok(memory.objectionIds.includes("think-about-it"));
  });

  it("keeps only the last three coach lines", () => {
    const memory = buildCallMemory("hi", ["a", "b", "c", "d"]);
    assert.deepEqual(memory.recentCoachLines, ["b", "c", "d"]);
  });

  it("keeps an opening snippet only for long calls", () => {
    const shortCall = buildCallMemory("we help roofers in San Antonio", []);
    assert.equal(shortCall.openingSnippet, "");
    const longCall = buildCallMemory("opening words here. " + "x".repeat(1200), []);
    assert.ok(longCall.openingSnippet.startsWith("opening words here."));
  });
});

describe("formatMemoryContext", () => {
  it("is empty when there is nothing to remember", () => {
    assert.equal(formatMemoryContext(buildCallMemory("hello there", [])), "");
  });

  it("lists raised objections and prior lines", () => {
    const ctx = formatMemoryContext(
      buildCallMemory("that's too expensive", ["What's one missed job worth?"]),
    );
    assert.match(ctx, /too expensive/);
    assert.match(ctx, /do NOT repeat/);
    assert.match(ctx, /missed job worth/);
  });
});

describe("filterRepEcho", () => {
  it("drops sentences that echo a recent coach line", () => {
    const coachLine =
      "No worries — is it bad timing, or do you feel covered on Google?";
    const mixed =
      "is it bad timing or do you feel covered on google? yeah we're covered.";
    const filtered = filterRepEcho(mixed, [coachLine]);
    assert.ok(!/bad timing/.test(filtered));
    assert.match(filtered, /we're covered/);
  });

  it("keeps prospect speech that shares no coach wording", () => {
    const filtered = filterRepEcho("that sounds way too expensive for me", [
      "Worth thirty seconds or bad time?",
    ]);
    assert.match(filtered, /too expensive/);
  });

  it("passes through untouched with no coach lines", () => {
    assert.equal(filterRepEcho("hello", []), "hello");
  });
});
