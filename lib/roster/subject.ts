import { sortSubjects } from "@/lib/roster/display";

export function subjectComparisonKey(subject: string): string {
  return subject
    .trim()
    .toLowerCase()
    .replace(/[\s\-_/]+/g, " ")
    .replace(/[^\w\s]/g, "")
    .trim();
}

export function collectExistingSubjects(
  subjects: (string | undefined | null)[],
): string[] {
  const seen = new Map<string, string>();

  for (const raw of subjects) {
    const trimmed = raw?.trim();
    if (!trimmed) continue;

    const key = subjectComparisonKey(trimmed);
    if (!key || seen.has(key)) continue;

    seen.set(key, trimmed);
  }

  return sortSubjects([...seen.values()]);
}

export function matchExistingSubject(
  input: string,
  existingSubjects: string[],
): string {
  const trimmed = input.trim();
  if (!trimmed) return "";

  const inputKey = subjectComparisonKey(trimmed);
  if (!inputKey) return trimmed;

  for (const existing of existingSubjects) {
    if (subjectComparisonKey(existing) === inputKey) {
      return existing;
    }
  }

  return trimmed;
}

export function filterSubjectSuggestions(
  query: string,
  existingSubjects: string[],
  limit = 8,
): string[] {
  const queryKey = subjectComparisonKey(query);

  if (!queryKey) {
    return sortSubjects([...existingSubjects]).slice(0, limit);
  }

  const scored = existingSubjects
    .map((subject) => {
      const subjectKey = subjectComparisonKey(subject);
      let score = 0;

      if (subjectKey === queryKey) score = 100;
      else if (subjectKey.startsWith(queryKey)) score = 80;
      else if (subjectKey.includes(queryKey)) score = 60;
      else return null;

      return { subject, score };
    })
    .filter((item): item is { subject: string; score: number } => item !== null)
    .sort(
      (a, b) => b.score - a.score || a.subject.localeCompare(b.subject),
    );

  return scored.slice(0, limit).map((item) => item.subject);
}
