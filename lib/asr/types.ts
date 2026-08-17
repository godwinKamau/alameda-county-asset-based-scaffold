export interface AsrWord {
  word: string;
  start: number;
  end: number;
  confidence: number;
}

export interface AsrResult {
  words: AsrWord[];
  transcript: string;
  durationSeconds: number;
  meanConfidence: number;
  provider: string;
  model: string;
}

export interface FluencyMetrics {
  speechRateWpm: number;
  articulationRateWpm: number;
  pauseCount250ms: number;
  pauseCount1000ms: number;
  longestPauseSeconds: number;
  meanLengthOfRunWords: number;
  longestRunWords: number;
  phonationTimeRatio: number;
  filledPauseCount: number;
  meanConfidence: number;
  lowConfidenceWordRatio: number;
}
