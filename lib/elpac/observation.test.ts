import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  deriveObservationLevel,
  deriveProtocolFromPlds,
  MIN_COVERAGE_RATIO,
  parseRequiredFrequency,
} from "./observation.ts";

const fixturePlds = {
  "1": {
    label: "Minimally Developed",
    frequency_marker: "may be able to",
    descriptors: ["Sometimes comprehend common words"],
  },
  "2": {
    label: "Somewhat Developed",
    frequency_marker: "can",
    descriptors: [
      "Sometimes comprehend key details",
      "Usually comprehend main ideas",
    ],
  },
  "3": {
    label: "Moderately Developed",
    frequency_marker: "can",
    descriptors: [
      "Usually comprehend key details",
      "Consistently comprehend main ideas",
    ],
  },
  "4": {
    label: "Well Developed",
    frequency_marker: "can",
    descriptors: ["Consistently comprehend inferences"],
  },
} as const;

describe("parseRequiredFrequency", () => {
  it("extracts embedded adverbs", () => {
    assert.equal(
      parseRequiredFrequency("Usually comprehend main ideas", "can"),
      "usually",
    );
    assert.equal(
      parseRequiredFrequency("Occasionally comprehend opinions", "can"),
      "sometimes",
    );
  });

  it("falls back to frequency marker", () => {
    assert.equal(
      parseRequiredFrequency("Comprehend short exchanges", "may be able to"),
      "sometimes",
    );
    assert.equal(
      parseRequiredFrequency("Comprehend short exchanges", "can"),
      "usually",
    );
  });
});

describe("deriveObservationLevel", () => {
  const protocol = deriveProtocolFromPlds(fixturePlds);

  it("returns insufficient coverage when too few checks", () => {
    const result = deriveObservationLevel(protocol, [
      { level: 1, index: 0, observed: "usually" },
    ]);
    assert.equal(result.level, null);
    assert.equal(result.reason, "insufficient_coverage");
  });

  it("applies monotone floor — level 4 not returned if level 2 unmet", () => {
    const observations = protocol.map((descriptor) => ({
      level: descriptor.level,
      index: descriptor.index,
      observed:
        descriptor.level === 4
          ? ("consistently" as const)
          : descriptor.level === 1
            ? ("usually" as const)
            : ("not_observed" as const),
    }));

    const result = deriveObservationLevel(protocol, observations);
    assert.notEqual(result.level, 4);
  });

  it("requires strong met descriptor at each achieved level", () => {
    const observations = protocol.map((descriptor) => ({
      level: descriptor.level,
      index: descriptor.index,
      observed:
        descriptor.level === 1
          ? ("sometimes" as const)
          : ("not_observed" as const),
    }));

    const result = deriveObservationLevel(protocol, observations);
    assert.equal(result.level, null);
  });

  it("passes at coverage boundary", () => {
    const rated = protocol.map((descriptor, index) => ({
      level: descriptor.level,
      index: descriptor.index,
      observed:
        index < Math.ceil(protocol.length * MIN_COVERAGE_RATIO)
          ? ("usually" as const)
          : ("not_observed" as const),
    }));
    const result = deriveObservationLevel(protocol, rated);
    assert.ok(result.coverageRatio >= MIN_COVERAGE_RATIO);
  });
});
