import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { releaseSpeechRecognition } from "./release-speech";

describe("releaseSpeechRecognition", () => {
  it("clears handlers and stops recognition", () => {
    let stopped = false;
    let aborted = false;
    const recognition = {
      onend: () => {},
      onresult: () => {},
      onerror: () => {},
      stop: () => {
        stopped = true;
      },
      abort: () => {
        aborted = true;
      },
    };
    releaseSpeechRecognition(recognition);
    assert.equal(recognition.onend, null);
    assert.equal(recognition.onresult, null);
    assert.equal(recognition.onerror, null);
    assert.equal(aborted, true);
    assert.equal(stopped, true);
  });
});
