import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  anticipateObjections,
  hasObjectionCue,
  matchObjections,
  seenObjectionIds,
  type ObjectionVars,
} from "./objection-library";

const VARS: ObjectionVars = {
  price: "$599",
  companyName: "Apex Build Partners",
  deliveryTimeline: "3 days",
};

describe("matchObjections", () => {
  it("matches price objection", () => {
    const hits = matchObjections("yeah man that's just too expensive for us");
    assert.equal(hits[0]?.id, "price");
  });

  it("ranks the most recent objection first", () => {
    const hits = matchObjections(
      "we're real busy right now and honestly not interested",
    );
    assert.equal(hits[0]?.id, "not-interested");
    assert.equal(hits[1]?.id, "busy");
  });

  it("matches nothing on neutral speech", () => {
    assert.equal(matchObjections("how does the process work exactly").length, 0);
  });

  it("matches the do-not-call compliance case", () => {
    const hits = matchObjections("take me off your list please");
    assert.equal(hits[0]?.id, "remove-me");
    assert.match(hits[0].counter(VARS), /off our list/i);
  });
});

describe("hasObjectionCue", () => {
  it("fires on think-about-it (new pattern)", () => {
    assert.equal(hasObjectionCue("let me think about it and call you"), true);
  });

  it("stays quiet on plain discovery talk", () => {
    assert.equal(hasObjectionCue("most of our jobs come in spring"), false);
  });
});

describe("seenObjectionIds", () => {
  it("collects objections across the whole call", () => {
    const ids = seenObjectionIds(
      "who is this? ... ok ... that's too expensive ... let me think about it",
    );
    assert.ok(ids.includes("who-is-this"));
    assert.ok(ids.includes("price"));
    assert.ok(ids.includes("think-about-it"));
  });
});

describe("anticipateObjections", () => {
  it("suggests likely pitch-stage objections", () => {
    const hints = anticipateObjections("pitch", [], VARS);
    assert.equal(hints.length, 2);
    assert.equal(hints[0].label, "too expensive");
    assert.ok(hints[0].line.includes("$599"));
  });

  it("skips objections already raised", () => {
    const hints = anticipateObjections("pitch", ["price"], VARS);
    assert.notEqual(hints[0]?.label, "too expensive");
  });

  it("returns nothing for wrap stage", () => {
    assert.equal(anticipateObjections("wrap", [], VARS).length, 0);
  });
});
