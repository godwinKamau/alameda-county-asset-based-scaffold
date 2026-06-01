import {
  normalizeSubject,
  formatRelativeTime,
} from "@/lib/roster/display";
import type { RosterEntryWithStats } from "@/lib/types";

export interface DashboardStats {
  totalStudents: number;
  subjectCount: number;
  analyzedThisMonth: number;
  neverAnalyzed: number;
  lastAnalysisSublabel: string;
}

function isInCurrentMonth(date: Date | null): boolean {
  if (!date) return false;
  const now = new Date();
  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth()
  );
}

export function computeDashboardStats(
  roster: RosterEntryWithStats[],
): DashboardStats {
  const subjects = new Set(
    roster.map((entry) => normalizeSubject(entry.subject)),
  );

  const neverAnalyzed = roster.filter((entry) => entry.session_count === 0).length;

  const analyzedThisMonth = roster.filter((entry) =>
    isInCurrentMonth(entry.last_session_at),
  ).length;

  const mostRecentSession = roster.reduce<Date | null>((latest, entry) => {
    if (!entry.last_session_at) return latest;
    const sessionDate = new Date(entry.last_session_at);
    if (!latest || sessionDate > latest) return sessionDate;
    return latest;
  }, null);

  const lastAnalysisRelative = formatRelativeTime(mostRecentSession);
  const lastAnalysisSublabel = lastAnalysisRelative
    ? `last analysis ${lastAnalysisRelative}`
    : "no analyses yet";

  return {
    totalStudents: roster.length,
    subjectCount: subjects.size,
    analyzedThisMonth,
    neverAnalyzed,
    lastAnalysisSublabel,
  };
}
