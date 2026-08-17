import { stringify } from "csv-stringify/sync";
import { ELPAC_DOMAINS, type ElpacDomain } from "@/lib/elpac/domain";
import { formatExactGradeLabel } from "@/lib/roster/display";
import { resolveDisplayName } from "@/lib/roster/group";
import type { ExactGrade } from "@/lib/types";

export interface LatestAnalysisSummary {
  domain: string;
  estimated_level: number;
  submitted_at: string;
}

export interface RosterScoreExportEntry {
  student_uuid: string;
  label: string;
  exact_grade: ExactGrade | null;
  session_count: number;
  avg_level: number | null;
  domain_levels: Record<ElpacDomain, number | null>;
  latest_analysis: LatestAnalysisSummary | null;
}

export interface TeacherGroupForExport {
  name: string;
  members: { student_uuid: string }[];
}

export interface BuildRosterScoresCsvOptions {
  scrubNames?: boolean;
  groups?: TeacherGroupForExport[];
}

const CSV_COLUMNS = [
  "name",
  "grade",
  "category",
  "total_analyses",
  "latest_analysis_date",
  "latest_analysis_domain",
  "latest_analysis_level",
  "avg_level",
  ...ELPAC_DOMAINS,
] as const;

export function buildStudentCategoryMap(
  groups: TeacherGroupForExport[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const group of groups) {
    for (const member of group.members) {
      map.set(member.student_uuid, group.name);
    }
  }
  return map;
}

function formatCategory(
  studentUuid: string,
  categoryMap: Map<string, string>,
): string {
  return categoryMap.get(studentUuid) ?? "Ungrouped";
}

function indexToLetters(index: number): string {
  let n = index + 1;
  let result = "";
  while (n > 0) {
    n -= 1;
    result = String.fromCharCode(65 + (n % 26)) + result;
    n = Math.floor(n / 26);
  }
  return result;
}

function scrubStudentLabel(index: number): string {
  return `Student ${indexToLetters(index)}`;
}

function formatGrade(exactGrade: ExactGrade | null): string {
  if (exactGrade) {
    return formatExactGradeLabel(exactGrade);
  }
  return "Grade not set";
}

function formatScore(level: number | null): string {
  if (level == null) return "";
  return String(Math.round(level * 10) / 10);
}

function formatAnalysisDate(submittedAt: string | null | undefined): string {
  if (!submittedAt) return "";
  return submittedAt.slice(0, 10);
}

function formatLatestAnalysis(
  latest: LatestAnalysisSummary | null | undefined,
): {
  latest_analysis_date: string;
  latest_analysis_domain: string;
  latest_analysis_level: string;
} {
  if (!latest) {
    return {
      latest_analysis_date: "",
      latest_analysis_domain: "",
      latest_analysis_level: "",
    };
  }

  return {
    latest_analysis_date: formatAnalysisDate(latest.submitted_at),
    latest_analysis_domain: latest.domain,
    latest_analysis_level: String(latest.estimated_level),
  };
}

function sortEntriesForExport(
  entries: RosterScoreExportEntry[],
): RosterScoreExportEntry[] {
  return [...entries].sort((a, b) =>
    resolveDisplayName(a).localeCompare(resolveDisplayName(b)),
  );
}

export interface RosterScoreExportRow {
  name: string;
  grade: string;
  category: string;
  total_analyses: string;
  latest_analysis_date: string;
  latest_analysis_domain: string;
  latest_analysis_level: string;
  avg_level: string;
  listening: string;
  speaking: string;
  reading: string;
  writing: string;
}

export const ROSTER_SCORE_EXPORT_COLUMNS = [
  { key: "name", label: "Name" },
  { key: "grade", label: "Grade" },
  { key: "category", label: "Category" },
  { key: "total_analyses", label: "Total analyses" },
  { key: "latest_analysis_date", label: "Latest analysis date" },
  { key: "latest_analysis_domain", label: "Latest analysis domain" },
  { key: "latest_analysis_level", label: "Latest analysis level" },
  { key: "avg_level", label: "Avg level" },
  { key: "listening", label: "Listening" },
  { key: "speaking", label: "Speaking" },
  { key: "reading", label: "Reading" },
  { key: "writing", label: "Writing" },
] as const satisfies ReadonlyArray<{
  key: keyof RosterScoreExportRow;
  label: string;
}>;

function buildExportRows(
  entries: RosterScoreExportEntry[],
  scrubNames: boolean,
  categoryMap: Map<string, string>,
): RosterScoreExportRow[] {
  const sorted = sortEntriesForExport(entries);

  return sorted.map((entry, index) => ({
    name: scrubNames ? scrubStudentLabel(index) : resolveDisplayName(entry),
    grade: formatGrade(entry.exact_grade),
    category: formatCategory(entry.student_uuid, categoryMap),
    total_analyses: String(entry.session_count),
    ...formatLatestAnalysis(entry.latest_analysis),
    avg_level: formatScore(entry.avg_level),
    listening: formatScore(entry.domain_levels.listening),
    speaking: formatScore(entry.domain_levels.speaking),
    reading: formatScore(entry.domain_levels.reading),
    writing: formatScore(entry.domain_levels.writing),
  }));
}

export function buildRosterScoreExportRows(
  entries: RosterScoreExportEntry[],
  options: BuildRosterScoresCsvOptions = {},
): RosterScoreExportRow[] {
  const categoryMap = buildStudentCategoryMap(options.groups ?? []);
  return buildExportRows(entries, options.scrubNames ?? false, categoryMap);
}

export function buildRosterScoresCsv(
  entries: RosterScoreExportEntry[],
  options: BuildRosterScoresCsvOptions = {},
): string {
  const categoryMap = buildStudentCategoryMap(options.groups ?? []);
  const rows = buildExportRows(
    entries,
    options.scrubNames ?? false,
    categoryMap,
  );

  return stringify(rows, {
    header: true,
    columns: [...CSV_COLUMNS],
  });
}

export function rosterScoresExportFilename(date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `roster-scores-${yyyy}-${mm}-${dd}.csv`;
}
