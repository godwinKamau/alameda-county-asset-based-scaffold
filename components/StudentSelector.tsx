"use client";

import { useEffect, useMemo, useState } from "react";
import {
  getStudentDisplayName,
  normalizeSubject,
} from "@/lib/roster/display";
import type { GradeSpan } from "@/lib/types";

export interface RosterOption {
  student_uuid: string;
  grade_span: GradeSpan;
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
      const response = await fetch("/api/roster/list");
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
            known_elpac_level: number | null;
          }) => ({
            ...entry,
            subject: entry.subject ?? "",
            label: resolveLabel(entry, mapping),
          }),
        ),
      );
      setLoading(false);
    }

    loadRoster();
  }, []);

  useEffect(() => {
    if (!value) return;
    const selected = filteredOptions.find(
      (option) => option.student_uuid === value,
    );
    if (!selected) {
      onChange("");
    }
  }, [filteredOptions, value, onChange]);

  return (
    <div>
      <label htmlFor="student" className="block text-sm font-medium text-slate-700">
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
        className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
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
            {option.label} ({option.grade_span})
          </option>
        ))}
      </select>
    </div>
  );
}
