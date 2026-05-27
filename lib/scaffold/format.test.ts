import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseInlineEmphasis,
  parseScaffoldItems,
} from "./format";

describe("parseScaffoldItems", () => {
  it("splits inline numbered suggestions", () => {
    const text =
      "1. First move with detail. 2. Second move with more detail.";
    assert.deepEqual(parseScaffoldItems(text), [
      "First move with detail.",
      "Second move with more detail.",
    ]);
  });

  it("splits newline numbered suggestions", () => {
    const text = "1. First move.\n2. Second move.";
    assert.deepEqual(parseScaffoldItems(text), [
      "First move.",
      "Second move.",
    ]);
  });
});

describe("parseInlineEmphasis", () => {
  it("parses markdown bold segments", () => {
    assert.deepEqual(
      parseInlineEmphasis("**Lead move** — follow-up detail."),
      [
        { type: "strong", value: "Lead move" },
        { type: "text", value: " — follow-up detail." },
      ],
    );
  });

  it("bolds lead phrase and quoted language for legacy text", () => {
    const segments = parseInlineEmphasis(
      "Using the student's own retell as a mentor text, invite them to add one 'thinking sentence' to each paragraph — a sentence that shares what they think.",
    );

    assert.ok(
      segments.some(
        (segment) =>
          segment.type === "strong" && segment.value.includes("mentor text"),
      ),
    );
    assert.ok(
      segments.some(
        (segment) =>
          segment.type === "strong" &&
          segment.value.includes("thinking sentence"),
      ),
    );
  });

  it("bolds the opening move before and ask", () => {
    const segments = parseInlineEmphasis(
      "Highlight the student's strong causal sentence ('it didn't work because he rushed') and ask them to add a 'because' sentence.",
    );

    assert.ok(
      segments.some(
        (segment) =>
          segment.type === "strong" &&
          segment.value.includes("causal sentence"),
      ),
    );
  });
});
