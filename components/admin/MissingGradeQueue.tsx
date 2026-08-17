"use client";

import { useCallback, useEffect, useState } from "react";
import { EXACT_GRADES } from "@/lib/roster/grade";
import { getStudentDisplayName } from "@/lib/roster/display";
import {
  btnPrimaryClassName,
  cardClassName,
  sectionTitleClassName,
  selectClassName,
} from "@/lib/ui/styles";
import { apiFetch } from "@/lib/ui/api-fetch";

interface MissingGradeStudent {
  id: string;
  student_uuid: string;
  label: string;
  subject: string;
  grade_span: string;
  known_elpac_level: number | null;
  created_at: string;
}

export function MissingGradeQueue({
  initialCount,
}: {
  initialCount: number;
}) {
  const [students, setStudents] = useState<MissingGradeStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUuid, setSavingUuid] = useState<string | null>(null);
  const [selectedGrades, setSelectedGrades] = useState<Record<string, string>>(
    {},
  );
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(initialCount);

  const loadStudents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiFetch("/api/admin/roster/missing-grade");
      if (!response.ok) {
        setError("Failed to load students missing a grade");
        return;
      }
      const data = await response.json();
      const rows = (data.students ?? []) as MissingGradeStudent[];
      setStudents(rows);
      setRemaining(rows.length);
    } catch {
      setError("Failed to load students missing a grade");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (initialCount > 0) {
      void loadStudents();
    } else {
      setLoading(false);
    }
  }, [initialCount, loadStudents]);

  async function handleSetGrade(studentUuid: string) {
    const exactGrade = selectedGrades[studentUuid];
    if (!exactGrade) return;

    setSavingUuid(studentUuid);
    setError(null);

    try {
      const response = await apiFetch("/api/admin/roster/missing-grade", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          student_uuid: studentUuid,
          exact_grade: exactGrade,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Failed to set grade");
        return;
      }

      setStudents((prev) => prev.filter((s) => s.student_uuid !== studentUuid));
      setRemaining((prev) => Math.max(0, prev - 1));
    } catch {
      setError("Failed to set grade");
    } finally {
      setSavingUuid(null);
    }
  }

  if (initialCount === 0 && remaining === 0) {
    return null;
  }

  return (
    <section className={cardClassName}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className={sectionTitleClassName}>Needs grade</h2>
        {remaining > 0 ? (
          <span className="inline-flex items-center rounded-full bg-orange-50 px-2.5 py-0.5 text-xs font-medium text-accent-orange">
            {remaining} student{remaining === 1 ? "" : "s"}
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-sm text-muted">
        Every student must have an exact grade before grade-based access can be
        enforced. Assign a grade for each student below.
      </p>

      {error ? (
        <p className="mt-3 text-sm text-error" role="alert">
          {error}
        </p>
      ) : null}

      {loading ? (
        <p className="mt-4 text-sm text-muted">Loading…</p>
      ) : students.length === 0 ? (
        <p className="mt-4 text-sm text-accent-green">
          All students at this school have an assigned grade.
        </p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-brand-soft/80">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-brand-soft bg-brand-soft/40 text-muted">
                <th className="px-4 py-3 font-medium">Student</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Grade span</th>
                <th className="px-4 py-3 font-medium">Exact grade</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => {
                const displayName = getStudentDisplayName({
                  label: student.label,
                  student_uuid: student.student_uuid,
                });
                return (
                  <tr
                    key={student.student_uuid}
                    className="border-b border-brand-soft/60 text-brand-dark last:border-0"
                  >
                    <td className="px-4 py-3">{displayName}</td>
                    <td className="px-4 py-3">{student.subject || "—"}</td>
                    <td className="px-4 py-3">{student.grade_span}</td>
                    <td className="px-4 py-3">
                      <select
                        className={selectClassName}
                        value={selectedGrades[student.student_uuid] ?? ""}
                        onChange={(event) =>
                          setSelectedGrades((prev) => ({
                            ...prev,
                            [student.student_uuid]: event.target.value,
                          }))
                        }
                        aria-label={`Exact grade for ${displayName}`}
                      >
                        <option value="">Select grade…</option>
                        {EXACT_GRADES.map((grade) => (
                          <option key={grade} value={grade}>
                            {grade === "K" ? "Kindergarten" : `Grade ${grade}`}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        className={btnPrimaryClassName}
                        disabled={
                          !selectedGrades[student.student_uuid] ||
                          savingUuid === student.student_uuid
                        }
                        onClick={() => void handleSetGrade(student.student_uuid)}
                      >
                        {savingUuid === student.student_uuid
                          ? "Saving…"
                          : "Set grade"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
