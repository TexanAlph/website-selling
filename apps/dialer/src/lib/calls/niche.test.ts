import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { normalizeNiche } from "./niche";

describe("normalizeNiche", () => {
  it("returns all for empty", () => {
    assert.equal(normalizeNiche(null), "all");
    assert.equal(normalizeNiche("  "), "all");
  });

  it("lowercases and collapses whitespace", () => {
    assert.equal(normalizeNiche("  Roofing   Contractor "), "roofing contractor");
  });
});
