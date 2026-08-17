import type { PldLevel } from "./types";

export const PROTOCOL_VERSION = "listening-v1";

export type ObservedFrequency =
  | "not_observed"
  | "sometimes"
  | "usually"
  | "consistently";

export const OBSERVED_FREQUENCY_ORDER: Record<ObservedFrequency, number> = {
  not_observed: 0,
  sometimes: 1,
  usually: 2,
  consistently: 3,
};

export interface ProtocolDescriptor {
  level: 1 | 2 | 3 | 4;
  index: number;
  text: string;
  requiredFrequency: ObservedFrequency;
}

export interface ObservationInput {
  level: number;
  index: number;
  observed: ObservedFrequency;
}

export interface ObservationLevelResult {
  level: number | null;
  confidence: "high" | "moderate" | "low";
  coverageRatio: number;
  reason?: string;
}

export const LEVEL_MET_THRESHOLD = 2 / 3;
export const MIN_COVERAGE_RATIO = 0.6;

const FREQUENCY_ADVERBS: Array<{
  pattern: RegExp;
  frequency: ObservedFrequency;
}> = [
  { pattern: /\bconsistently\b/i, frequency: "consistently" },
  { pattern: /\busually\b/i, frequency: "usually" },
  { pattern: /\bsometimes\b/i, frequency: "sometimes" },
  { pattern: /\boccasionally\b/i, frequency: "sometimes" },
];

export function parseRequiredFrequency(
  descriptor: string,
  frequencyMarker: string,
): ObservedFrequency {
  for (const { pattern, frequency } of FREQUENCY_ADVERBS) {
    if (pattern.test(descriptor)) {
      return frequency;
    }
  }

  if (frequencyMarker === "may be able to") {
    return "sometimes";
  }

  return "usually";
}

export function deriveProtocolFromPlds(
  plds: Record<"1" | "2" | "3" | "4", PldLevel>,
): ProtocolDescriptor[] {
  const descriptors: ProtocolDescriptor[] = [];

  for (const level of [1, 2, 3, 4] as const) {
    plds[level].descriptors.forEach((text, index) => {
      descriptors.push({
        level,
        index,
        text,
        requiredFrequency: parseRequiredFrequency(
          text,
          plds[level].frequency_marker,
        ),
      });
    });
  }

  return descriptors;
}

function levelAchieved(
  protocol: ProtocolDescriptor[],
  observations: Map<string, ObservedFrequency>,
  level: 1 | 2 | 3 | 4,
): boolean {
  const levelDescriptors = protocol.filter((item) => item.level === level);
  if (levelDescriptors.length === 0) return false;

  let metCount = 0;
  let hasStrongMet = false;

  for (const descriptor of levelDescriptors) {
    const key = `${descriptor.level}:${descriptor.index}`;
    const observed = observations.get(key) ?? "not_observed";
    if (
      OBSERVED_FREQUENCY_ORDER[observed] >=
      OBSERVED_FREQUENCY_ORDER[descriptor.requiredFrequency]
    ) {
      metCount += 1;
      if (
        OBSERVED_FREQUENCY_ORDER[observed] >=
        OBSERVED_FREQUENCY_ORDER.usually
      ) {
        hasStrongMet = true;
      }
    }
  }

  return (
    metCount / levelDescriptors.length >= LEVEL_MET_THRESHOLD && hasStrongMet
  );
}

export function deriveObservationLevel(
  protocol: ProtocolDescriptor[],
  observations: ObservationInput[],
): ObservationLevelResult {
  const observationMap = new Map<string, ObservedFrequency>();
  let ratedCount = 0;

  for (const observation of observations) {
    const key = `${observation.level}:${observation.index}`;
    observationMap.set(key, observation.observed);
    if (observation.observed !== "not_observed") {
      ratedCount += 1;
    }
  }

  const coverageRatio =
    protocol.length > 0 ? ratedCount / protocol.length : 0;

  if (coverageRatio < MIN_COVERAGE_RATIO) {
    return {
      level: null,
      confidence: "low",
      coverageRatio,
      reason: "insufficient_coverage",
    };
  }

  let achievedLevel: 1 | 2 | 3 | 4 | null = null;
  for (const level of [1, 2, 3, 4] as const) {
    if (levelAchieved(protocol, observationMap, level)) {
      achievedLevel = level;
    } else {
      break;
    }
  }

  const confidence: ObservationLevelResult["confidence"] =
    coverageRatio >= 0.85
      ? "high"
      : coverageRatio >= MIN_COVERAGE_RATIO
        ? "moderate"
        : "low";

  return {
    level: achievedLevel,
    confidence,
    coverageRatio,
  };
}

export function formatObservationSummary(
  protocol: ProtocolDescriptor[],
  observations: ObservationInput[],
  derivedLevel: number,
): string {
  const observationMap = new Map(
    observations.map((item) => [`${item.level}:${item.index}`, item.observed]),
  );

  const lines = protocol
    .filter((descriptor) => {
      const observed =
        observationMap.get(`${descriptor.level}:${descriptor.index}`) ??
        "not_observed";
      return observed !== "not_observed";
    })
    .map((descriptor) => {
      const observed =
        observationMap.get(`${descriptor.level}:${descriptor.index}`) ??
        "not_observed";
      return `- Level ${descriptor.level} descriptor ${descriptor.index + 1} (${observed}): ${descriptor.text}`;
    });

  return `OBSERVATION PROTOCOL RESULT (derived level ${derivedLevel}):
${lines.join("\n")}`;
}
