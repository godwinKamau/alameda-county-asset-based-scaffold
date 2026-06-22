import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it } from "node:test";
import { loadFrameworkMovesFromDirectory } from "./load-core";
import {
  filterMovesForExactGrade,
  gradeBandMatchesExactGrade,
  mergeFrameworkGradeSpans,
} from "./merge";
import { buildFrameworkBlockFromMoves } from "./prompt-block";
import type { FrameworkGradeSpan } from "./types";

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "__fixtures__",
);

describe("mergeFrameworkGradeSpans", () => {
  it("concatenates moves for the same grade span and level", () => {
    const target: FrameworkGradeSpan = {
      "1-2": {
        "2": [
          {
            theme: "foundational_skills",
            eld_mode: "designated",
            move: "First move",
            framework_anchor: "Anchor A",
          },
        ],
      },
    };

    mergeFrameworkGradeSpans(target, {
      "1-2": {
        "2": [
          {
            theme: "language_development" as const,
            eld_mode: "integrated" as const,
            move: "Second move",
            framework_anchor: "Anchor B",
          },
        ],
        "3": [
          {
            theme: "meaning_making" as const,
            eld_mode: "designated" as const,
            move: "Third move",
            framework_anchor: "Anchor C",
          },
        ],
      },
    });

    assert.equal(target["1-2"]?.["2"]?.length, 2);
    assert.equal(target["1-2"]?.["3"]?.length, 1);
  });
});

describe("filterMovesForExactGrade", () => {
  it("prefers moves whose grade_band matches the exact grade", () => {
    const moves = [
      {
        theme: "meaning_making" as const,
        eld_mode: "integrated" as const,
        move: "Grade 3 move",
        framework_anchor: "A",
        grade_band: "2-3" as const,
      },
      {
        theme: "effective_expression" as const,
        eld_mode: "designated" as const,
        move: "Grade 7 move",
        framework_anchor: "B",
        grade_band: "6-8" as const,
      },
    ];

    const filtered = filterMovesForExactGrade(moves, "3");
    assert.equal(filtered.length, 1);
    assert.match(filtered[0].move, /Grade 3 move/);
  });

  it("falls back to untagged moves when no grade_band matches", () => {
    const moves = [
      {
        theme: "language_development" as const,
        eld_mode: "designated" as const,
        move: "Untagged move",
        framework_anchor: "A",
      },
      {
        theme: "content_knowledge" as const,
        eld_mode: "integrated" as const,
        move: "Other band move",
        framework_anchor: "B",
        grade_band: "9-12" as const,
      },
    ];

    const filtered = filterMovesForExactGrade(moves, "5");
    assert.equal(filtered.length, 1);
    assert.match(filtered[0].move, /Untagged move/);
  });

  it("returns all moves when no preferred or untagged moves exist", () => {
    const moves = [
      {
        theme: "content_knowledge" as const,
        eld_mode: "integrated" as const,
        move: "Only other band move",
        framework_anchor: "B",
        grade_band: "9-12" as const,
      },
    ];

    const filtered = filterMovesForExactGrade(moves, "5");
    assert.equal(filtered.length, 1);
  });
});

describe("gradeBandMatchesExactGrade", () => {
  it("matches grades within a band", () => {
    assert.equal(gradeBandMatchesExactGrade("2-3", "2"), true);
    assert.equal(gradeBandMatchesExactGrade("2-3", "4"), false);
  });
});

describe("loadFrameworkMovesFromDirectory", () => {
  it("merges chapter fixture files by span and level", () => {
    const merged = loadFrameworkMovesFromDirectory(fixturesDir);
    assert.ok(merged);
    assert.equal(merged.writing_moves.K?.["2"]?.length, 1);
    assert.equal(merged.writing_moves["1-2"]?.["2"]?.length, 1);
    assert.equal(merged.writing_moves["1-2"]?.["3"]?.length, 1);
    assert.equal(merged.writing_moves["3-12"]?.["3"]?.length, 2);
  });
});

describe("buildFrameworkBlockFromMoves", () => {
  it("filters 3-12 moves by exact grade when provided", () => {
    const merged = loadFrameworkMovesFromDirectory(fixturesDir);
    const { block } = buildFrameworkBlockFromMoves(
      merged?.writing_moves["3-12"] ?? null,
      "3-12",
      "3",
    );

    assert.match(block, /claim and evidence/);
    assert.doesNotMatch(block, /precise verbs/);
  });

  it("tags moves with [F#] ids and returns citableMoves", () => {
    const merged = loadFrameworkMovesFromDirectory(fixturesDir);
    const { block, citableMoves } = buildFrameworkBlockFromMoves(
      merged?.writing_moves["3-12"] ?? null,
      "3-12",
      "3",
    );

    assert.match(block, /\[F1\]/);
    assert.ok(citableMoves.length > 0);
  });

  it("returns an empty block when no moves exist", () => {
    const { block, citableMoves } = buildFrameworkBlockFromMoves(null, "K", "K");
    assert.equal(block, "");
    assert.deepEqual(citableMoves, []);
  });
});
