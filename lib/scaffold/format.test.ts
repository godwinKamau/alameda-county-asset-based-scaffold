import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  parseInlineEmphasis,
  parseScaffoldItems,
  parseSentences,
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

describe("parseSentences", () => {
  it("splits multiple sentences and applies inline emphasis", () => {
    const sentences = parseSentences(
      "The student uses **simple conjunctions**. They show **topic-relevant vocabulary**.",
    );

    assert.equal(sentences.length, 2);
    assert.deepEqual(sentences[0], [
      { type: "text", value: "The student uses " },
      { type: "strong", value: "simple conjunctions" },
      { type: "text", value: "." },
    ]);
    assert.ok(
      sentences[1].some(
        (segment) =>
          segment.type === "strong" && segment.value === "topic-relevant vocabulary",
      ),
    );
  });

  it("returns a single parsed sentence for one-sentence text", () => {
    const sentences = parseSentences("One sentence without trailing punctuation");
    assert.equal(sentences.length, 1);
    assert.ok(sentences[0].length > 0);
  });
});
