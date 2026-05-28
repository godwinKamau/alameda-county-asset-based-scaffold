export const CA_ELD_LEVEL_LABELS = {
  1: "Emerging",
  2: "Expanding",
  3: "Expanding–Bridging",
  4: "Bridging",
} as const;

export const ELPAC_PERFORMANCE_LEVEL_LABELS = {
  1: "Minimally Developed",
  2: "Somewhat Developed",
  3: "Moderately Developed",
  4: "Well Developed",
} as const;

export type ElPacLevel = keyof typeof CA_ELD_LEVEL_LABELS;

export function getCaEldLevelLabel(level: number): string {
  if (level in CA_ELD_LEVEL_LABELS) {
    return CA_ELD_LEVEL_LABELS[level as ElPacLevel];
  }
  return `Level ${level}`;
}

export function getElpacPerformanceLevelLabel(level: number): string {
  if (level in ELPAC_PERFORMANCE_LEVEL_LABELS) {
    return ELPAC_PERFORMANCE_LEVEL_LABELS[level as ElPacLevel];
  }
  return `Level ${level}`;
}
