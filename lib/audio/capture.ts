import {
  AUDIO_BITS_PER_SECOND,
  MAX_AUDIO_DURATION_SECONDS,
  PREFERRED_MIME_TYPES,
} from "./constants";

export function selectRecorderMimeType(): string | null {
  if (typeof MediaRecorder === "undefined") {
    return null;
  }

  for (const mimeType of PREFERRED_MIME_TYPES) {
    if (MediaRecorder.isTypeSupported(mimeType)) {
      return mimeType;
    }
  }

  return null;
}

export interface RecordAudioOptions {
  maxDurationSeconds?: number;
  audioBitsPerSecond?: number;
  onDuration?: (seconds: number) => void;
}

export async function recordAudio(
  options: RecordAudioOptions = {},
): Promise<{ blob: Blob; mimeType: string; durationSeconds: number }> {
  const mimeType = selectRecorderMimeType();
  if (!mimeType) {
    throw new Error("This browser cannot record audio in a supported format.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const maxDuration = options.maxDurationSeconds ?? MAX_AUDIO_DURATION_SECONDS;

  try {
    const recorder = new MediaRecorder(stream, {
      mimeType,
      audioBitsPerSecond:
        options.audioBitsPerSecond ?? AUDIO_BITS_PER_SECOND,
    });

    const chunks: Blob[] = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunks.push(event.data);
      }
    };

    const startedAt = performance.now();

    const blob = await new Promise<Blob>((resolve, reject) => {
      recorder.onerror = () => reject(new Error("Recording failed."));
      recorder.onstop = () => {
        resolve(new Blob(chunks, { type: mimeType }));
      };

      recorder.start(250);

      const interval = window.setInterval(() => {
        const elapsed = (performance.now() - startedAt) / 1000;
        options.onDuration?.(elapsed);
        if (elapsed >= maxDuration) {
          if (recorder.state === "recording") {
            recorder.stop();
          }
        }
      }, 200);
      recorder.addEventListener(
        "stop",
        () => {
          window.clearInterval(interval);
        },
        { once: true },
      );
    });

    const durationSeconds = (performance.now() - startedAt) / 1000;
    return { blob, mimeType, durationSeconds };
  } finally {
    for (const track of stream.getTracks()) {
      track.stop();
    }
  }
}

export async function startMicrophoneRecorder(
  options: RecordAudioOptions = {},
): Promise<{
  stop: () => Promise<{ blob: Blob; mimeType: string; durationSeconds: number }>;
  cancel: () => void;
}> {
  const mimeType = selectRecorderMimeType();
  if (!mimeType) {
    throw new Error("This browser cannot record audio in a supported format.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const maxDuration = options.maxDurationSeconds ?? MAX_AUDIO_DURATION_SECONDS;
  const recorder = new MediaRecorder(stream, {
    mimeType,
    audioBitsPerSecond: options.audioBitsPerSecond ?? AUDIO_BITS_PER_SECOND,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const startedAt = performance.now();
  let interval: number | null = null;

  recorder.start(250);
  interval = window.setInterval(() => {
    const elapsed = (performance.now() - startedAt) / 1000;
    options.onDuration?.(elapsed);
    if (elapsed >= maxDuration && recorder.state === "recording") {
      recorder.stop();
    }
  }, 200);

  const cleanup = () => {
    if (interval != null) {
      window.clearInterval(interval);
    }
    for (const track of stream.getTracks()) {
      track.stop();
    }
  };

  return {
    cancel: () => {
      if (recorder.state !== "inactive") {
        recorder.stop();
      }
      cleanup();
    },
    stop: () =>
      new Promise((resolve, reject) => {
        recorder.onerror = () => {
          cleanup();
          reject(new Error("Recording failed."));
        };
        recorder.onstop = () => {
          cleanup();
          resolve({
            blob: new Blob(chunks, { type: mimeType }),
            mimeType,
            durationSeconds: (performance.now() - startedAt) / 1000,
          });
        };
        if (recorder.state === "recording") {
          recorder.stop();
        }
      }),
  };
}
