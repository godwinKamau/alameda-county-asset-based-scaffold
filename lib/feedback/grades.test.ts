import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { GradeGrant } from "@/lib/types";
import {
  formatGradeAccessLabel,
  gradesSnapshotFromGrants,
  SCHOOL_GRADE_SENTINEL,
} from "./grades.ts";

function grant(exactGrade: GradeGrant["exact_grade"]): GradeGrant {
  return {
    id: "grant-id",
    teacher_id: "teacher-id",
    school_id: "school-id",
    exact_grade: exactGrade,
    granted_by: null,
    granted_at: new Date("2026-01-01T00:00:00.000Z"),
    expires_at: null,
    revoked_at: null,
    revoked_by: null,
    origin: "admin",
    request_id: null,
    note: null,
  };
}

describe("gradesSnapshotFromGrants", () => {
  it("returns empty array when there are no grants", () => {
    assert.deepEqual(gradesSnapshotFromGrants([]), []);
  });

  it("returns school sentinel for a school-wide grant", () => {
    assert.deepEqual(gradesSnapshotFromGrants([grant(null)]), [
      SCHOOL_GRADE_SENTINEL,
    ]);
  });

  it("prefers school-wide over specific grades", () => {
    assert.deepEqual(
      gradesSnapshotFromGrants([grant("3"), grant(null), grant("K")]),
      [SCHOOL_GRADE_SENTINEL],
    );
  });

  it("deduplicates and orders specific grades with K first", () => {
    assert.deepEqual(
      gradesSnapshotFromGrants([
        grant("10"),
        grant("3"),
        grant("K"),
        grant("3"),
      ]),
      ["K", "3", "10"],
    );
  });
});

describe("formatGradeAccessLabel", () => {
  it("describes empty access", () => {
    assert.equal(formatGradeAccessLabel([]), "No grade access yet");
  });

  it("describes school-wide access", () => {
    assert.equal(formatGradeAccessLabel([SCHOOL_GRADE_SENTINEL]), "Whole school (all grades)");
  });

  it("describes specific grades", () => {
    assert.equal(formatGradeAccessLabel(["K", "3", "10"]), "Grade K, Grade 3, Grade 10");
  });
});
