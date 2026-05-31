import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSystemPrompt } from "./prompt-build";

describe("buildSystemPrompt", () => {
  it("does not inject framework moves when no data/framework directory exists", () => {
    const prompt = buildSystemPrompt("writing", "3-12", "5");

    assert.doesNotMatch(prompt, /SUGGESTED INSTRUCTIONAL MOVES/);
    assert.doesNotMatch(prompt, /When framework moves are provided above/);
  });

  it("does not inject framework moves for non-writing domains", () => {
    const prompt = buildSystemPrompt("reading", "3-12", "5");

    assert.doesNotMatch(prompt, /SUGGESTED INSTRUCTIONAL MOVES/);
  });

  it("retains core PLD-grounded analysis rules for writing", () => {
    const prompt = buildSystemPrompt("writing", "1-2", "2");

    assert.match(prompt, /OFFICIAL ELPAC WRITING RANGE PLDs FOR GRADE SPAN 1-2:/);
    assert.match(prompt, /Every strength you identify must map explicitly to a PLD descriptor above/);
    assert.match(
      prompt,
      /tied to the student's own writing — not a generic strategy/,
    );
  });
});
