export interface TextSegment {
  type: "text" | "strong";
  value: string;
}

export function parseScaffoldItems(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const lines = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length > 1 && lines.every((line) => /^\d+\.\s/.test(line))) {
    return lines.map((line) => line.replace(/^\d+\.\s*/, "").trim());
  }

  if (/^\d+\.\s/.test(trimmed)) {
    const parts = trimmed.split(/\s(?=\d+\.\s)/);
    if (parts.length > 1) {
      return parts.map((part) => part.replace(/^\d+\.\s*/, "").trim());
    }
  }

  return [trimmed.replace(/^\d+\.\s*/, "").trim()];
}

const QUOTED_PHRASE_PATTERN = /(?<![\w])('[^']+'|"[^"]+")/g;

function parseMarkdownBold(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }
    segments.push({ type: "strong", value: match[1] });
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", value: text.slice(lastIndex) });
  }

  return segments.filter(
    (segment) => segment.type === "strong" || segment.value.length > 0,
  );
}

function pushQuotedSegments(text: string, segments: TextSegment[]): string {
  QUOTED_PHRASE_PATTERN.lastIndex = 0;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = QUOTED_PHRASE_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({
        type: "text",
        value: text.slice(lastIndex, match.index),
      });
    }
    segments.push({ type: "strong", value: match[1] });
    lastIndex = match.index + match[0].length;
  }

  return text.slice(lastIndex);
}

function pushLeadPhrase(text: string, segments: TextSegment[]): string {
  const dashIndex = text.indexOf(" — ");
  if (dashIndex > 0 && dashIndex <= 140) {
    segments.push({
      type: "strong",
      value: text.slice(0, dashIndex).trim(),
    });
    return text.slice(dashIndex);
  }

  const askMatch = text.match(/^(.+?)\s+and ask\b/i);
  if (askMatch && askMatch[1].length > 0 && askMatch[1].length <= 140) {
    segments.push({ type: "strong", value: askMatch[1].trim() });
    return text.slice(askMatch[1].length);
  }

  const inviteMatch = text.match(/^(.+?)\s+and invite\b/i);
  if (inviteMatch && inviteMatch[1].length > 0 && inviteMatch[1].length <= 140) {
    segments.push({ type: "strong", value: inviteMatch[1].trim() });
    return text.slice(inviteMatch[1].length);
  }

  return text;
}

export function parseInlineEmphasis(text: string): TextSegment[] {
  if (text.includes("**")) {
    return parseMarkdownBold(text);
  }

  const segments: TextSegment[] = [];
  let remaining = pushLeadPhrase(text, segments);
  remaining = pushQuotedSegments(remaining, segments);

  if (remaining.length > 0) {
    segments.push({ type: "text", value: remaining });
  }

  if (segments.length === 0) {
    segments.push({ type: "text", value: text });
  }

  return segments.filter(
    (segment) => segment.type === "strong" || segment.value.length > 0,
  );
}

export function parseSentences(text: string): TextSegment[][] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  const sentences = trimmed.split(/(?<=[.!?])\s+/).filter(Boolean);

  if (sentences.length === 0) {
    return [parseInlineEmphasis(trimmed)];
  }

  return sentences.map((sentence) => parseInlineEmphasis(sentence.trim()));
}
