import type { AsrWord, FluencyMetrics } from "@/lib/asr/types";

const PAUSE_THRESHOLD_SECONDS = 0.25;
const LONG_PAUSE_THRESHOLD_SECONDS = 1;
const LOW_CONFIDENCE_THRESHOLD = 0.6;

const FILLED_PAUSE_TOKENS = new Set([
  "um",
  "uh",
  "er",
  "erm",
  "mm",
  "hmm",
]);

function countFilledPauses(words: AsrWord[]): number {
  return words.filter((word) =>
    FILLED_PAUSE_TOKENS.has(word.word.toLowerCase().replace(/[^a-z]/g, "")),
  ).length;
}

function computeRuns(words: AsrWord[]): number[] {
  if (words.length === 0) return [];

  const pauses: number[] = [];
  for (let index = 1; index < words.length; index += 1) {
    pauses.push(words[index].start - words[index - 1].end);
  }

  const runs: number[] = [];
  let currentRun = 1;
  for (const pause of pauses) {
    if (pause >= PAUSE_THRESHOLD_SECONDS) {
      runs.push(currentRun);
      currentRun = 1;
    } else {
      currentRun += 1;
    }
  }
  runs.push(currentRun);
  return runs;
}

export function computeFluencyMetrics(
  words: AsrWord[],
  durationSeconds: number,
): FluencyMetrics {
  const safeDuration = Math.max(durationSeconds, 0.001);
  const wordCount = words.length;

  const pauses: number[] = [];
  for (let index = 1; index < words.length; index += 1) {
    pauses.push(words[index].start - words[index - 1].end);
  }

  const pauseCount250ms = pauses.filter(
    (pause) => pause >= PAUSE_THRESHOLD_SECONDS,
  ).length;
  const pauseCount1000ms = pauses.filter(
    (pause) => pause >= LONG_PAUSE_THRESHOLD_SECONDS,
  ).length;
  const longestPauseSeconds = pauses.length > 0 ? Math.max(...pauses) : 0;

  const phonationTime = words.reduce(
    (sum, word) => sum + Math.max(0, word.end - word.start),
    0,
  );
  const phonationTimeRatio = Math.min(
    1,
    Math.max(0, phonationTime / safeDuration),
  );

  const runs = computeRuns(words);
  const meanLengthOfRunWords =
    runs.length > 0 ? runs.reduce((sum, run) => sum + run, 0) / runs.length : 0;
  const longestRunWords = runs.length > 0 ? Math.max(...runs) : 0;

  const speechRateWpm = (wordCount / safeDuration) * 60;
  const articulationRateWpm =
    phonationTime > 0 ? (wordCount / phonationTime) * 60 : speechRateWpm;

  const meanConfidence =
    wordCount > 0
      ? words.reduce((sum, word) => sum + word.confidence, 0) / wordCount
      : 0;
  const lowConfidenceWordRatio =
    wordCount > 0
      ? words.filter((word) => word.confidence < LOW_CONFIDENCE_THRESHOLD).length /
        wordCount
      : 0;

  return {
    speechRateWpm: Math.round(speechRateWpm * 10) / 10,
    articulationRateWpm: Math.round(articulationRateWpm * 10) / 10,
    pauseCount250ms,
    pauseCount1000ms,
    longestPauseSeconds: Math.round(longestPauseSeconds * 100) / 100,
    meanLengthOfRunWords: Math.round(meanLengthOfRunWords * 10) / 10,
    longestRunWords,
    phonationTimeRatio: Math.round(phonationTimeRatio * 1000) / 1000,
    filledPauseCount: countFilledPauses(words),
    meanConfidence: Math.round(meanConfidence * 1000) / 1000,
    lowConfidenceWordRatio: Math.round(lowConfidenceWordRatio * 1000) / 1000,
  };
}

export function formatDeliveryEvidence(
  metrics: FluencyMetrics,
  gradeSpan: string,
): string {
  return `MEASURED DELIVERY EVIDENCE (fluency and hesitation only — not pronunciation or intonation):
- Grade span context: ${gradeSpan}
- Speech rate: ${metrics.speechRateWpm} words/min (total duration)
- Articulation rate: ${metrics.articulationRateWpm} words/min (phonation time only)
- Pauses ≥250ms: ${metrics.pauseCount250ms}; pauses ≥1s: ${metrics.pauseCount1000ms}
- Longest pause: ${metrics.longestPauseSeconds}s
- Mean words between pauses: ${metrics.meanLengthOfRunWords}; longest run: ${metrics.longestRunWords} words
- Phonation time ratio: ${metrics.phonationTimeRatio}
- Filled pauses (um/uh/etc.): ${metrics.filledPauseCount}
- Mean ASR confidence (intelligibility proxy): ${metrics.meanConfidence}
- Low-confidence word ratio: ${metrics.lowConfidenceWordRatio}`;
}
