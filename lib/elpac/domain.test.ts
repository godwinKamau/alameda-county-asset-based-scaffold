import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapGradeSpanToPldSpan } from "./domain.ts";

describe("mapGradeSpanToPldSpan", () => {
  it("maps listening K to K-2 span", () => {
    assert.equal(mapGradeSpanToPldSpan("listening", "K"), "K-2");
  });

  it("maps speaking 1-2 to K-2 span", () => {
    assert.equal(mapGradeSpanToPldSpan("speaking", "1-2"), "K-2");
  });

  it("maps writing 3-12 directly", () => {
    assert.equal(mapGradeSpanToPldSpan("writing", "3-12"), "3-12");
  });

  it("maps reading K directly", () => {
    assert.equal(mapGradeSpanToPldSpan("reading", "K"), "K");
  });
});
