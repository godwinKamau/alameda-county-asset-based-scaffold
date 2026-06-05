"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatStudentGradeLabel,
  getStudentDisplayName,
  normalizeSubject,
} from "@/lib/roster/display";
import type { ExactGrade, GradeSpan } from "@/lib/types";
import { apiFetch, isDatabaseWakingError } from "@/lib/ui/api-fetch";
import { labelClassName, selectClassName } from "@/lib/ui/styles";

export interface RosterOption {
  student_uuid: string;
  grade_span: GradeSpan;
  exact_grade: ExactGrade | null;
  known_elpac_level: number | null;
  label: string;
  subject: string;
}

interface StudentSelectorProps {
  value: string;
  onChange: (studentUuid: string, option?: RosterOption) => void;
  subjectFilter?: string;
}

function getLabelMapping(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("student_label_mapping") ?? "{}");
  } catch {
    return {};
  }
}

function resolveLabel(
  entry: { student_uuid: string; label?: string },
  mapping: Record<string, string>,
): string {
  const fromDb = entry.label?.trim();
  if (fromDb) return fromDb;
  const fromLocal = mapping[entry.student_uuid]?.trim();
  if (fromLocal) return fromLocal;
  return getStudentDisplayName({
    label: "",
    student_uuid: entry.student_uuid,
  });
}

export function StudentSelector({
  value,
  onChange,
  subjectFilter = "All",
}: StudentSelectorProps) {
  const [options, setOptions] = useState<RosterOption[]>([]);
  const [loading, setLoading] = useState(true);

  const filteredOptions = useMemo(() => {
    if (subjectFilter === "All") return options;
    return options.filter(
      (option) => normalizeSubject(option.subject) === subjectFilter,
    );
  }, [options, subjectFilter]);

  useEffect(() => {
    async function loadRoster() {
      try {
        const response = await apiFetch("/api/roster/list");
        if (!response.ok) {
          setLoading(false);
          return;
        }

        const data = await response.json();
        const mapping = getLabelMapping();

        setOptions(
          data.entries.map(
            (entry: {
              student_uuid: string;
              label?: string;
              subject?: string;
              grade_span: GradeSpan;
              exact_grade: ExactGrade | null;
              known_elpac_level: number | null;
            }) => ({
              ...entry,
              subject: entry.subject ?? "",
              exact_grade: entry.exact_grade ?? null,
              label: resolveLabel(entry, mapping),
            }),
          ),
        );
      } catch (loadError) {
        if (!isDatabaseWakingError(loadError)) {
          console.error("[StudentSelector] Failed to load roster", loadError);
        }
      } finally {
        setLoading(false);
      }
    }

    loadRoster();
  }, []);

  useEffect(() => {
    if (!value || loading) return;
    const selected = filteredOptions.find(
      (option) => option.student_uuid === value,
    );
    if (!selected) {
      onChange("");
    }
  }, [filteredOptions, value, onChange, loading]);

  return (
    <div>
      <label htmlFor="student" className={labelClassName}>
        Student
      </label>
      <select
        id="student"
        value={value}
        onChange={(event) => {
          const selected = filteredOptions.find(
            (option) => option.student_uuid === event.target.value,
          );
          onChange(event.target.value, selected);
        }}
        disabled={loading || filteredOptions.length === 0}
        className={selectClassName}
      >
        <option value="">
          {loading
            ? "Loading roster…"
            : filteredOptions.length === 0
              ? subjectFilter === "All"
                ? "No students — add or upload a roster first"
                : "No students in this subject"
              : "Select a student"}
        </option>
        {filteredOptions.map((option) => (
          <option key={option.student_uuid} value={option.student_uuid}>
            {option.label} ({formatStudentGradeLabel(option.grade_span, option.exact_grade)})
          </option>
        ))}
      </select>
    </div>
  );
}
