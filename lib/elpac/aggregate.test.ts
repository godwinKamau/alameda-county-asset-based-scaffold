import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeDomainLevels, computeDomainLevelsFromAggregates } from "./aggregate.ts";

describe("computeDomainLevelsFromAggregates", () => {
  it("averages primary evidence only", () => {
    const result = computeDomainLevelsFromAggregates([
      {
        domain: "writing",
        evidence_kind: "written_artifact",
        level_sum: 5,
        session_count: 2,
      },
      {
        domain: "writing",
        evidence_kind: "observation_protocol",
        level_sum: 4,
        session_count: 1,
      },
    ]);

    const writing = result.find((row) => row.domain === "writing");
    assert.equal(writing?.level, 2.5);
    assert.equal(writing?.primaryCount, 2);
    assert.equal(writing?.supportingCount, 1);
  });

  it("excludes invalid evidence and counts it", () => {
    const result = computeDomainLevelsFromAggregates([
      {
        domain: "speaking",
        evidence_kind: "written_artifact",
        level_sum: 3,
        session_count: 1,
      },
    ]);

    const speaking = result.find((row) => row.domain === "speaking");
    assert.equal(speaking?.level, null);
    assert.equal(speaking?.excludedCount, 1);
  });

  it("returns null level when only invalid evidence exists", () => {
    const result = computeDomainLevels([
      { domain: "listening", estimated_level: 2, evidence_kind: "written_artifact" },
    ]);
    const listening = result.find((row) => row.domain === "listening");
    assert.equal(listening?.level, null);
    assert.equal(listening?.excludedCount, 1);
  });

  it("recombines grouped rows consistently", () => {
    const single = computeDomainLevelsFromAggregates([
      {
        domain: "reading",
        evidence_kind: "written_artifact",
        level_sum: 6,
        session_count: 2,
      },
    ]);
    const split = computeDomainLevelsFromAggregates([
      {
        domain: "reading",
        evidence_kind: "written_artifact",
        level_sum: 3,
        session_count: 1,
      },
      {
        domain: "reading",
        evidence_kind: "written_artifact",
        level_sum: 3,
        session_count: 1,
      },
    ]);
    assert.equal(single[2]?.level, split[2]?.level);
  });
});
