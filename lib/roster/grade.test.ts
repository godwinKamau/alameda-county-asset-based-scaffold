import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveRosterGradeFields } from "./grade";

describe("resolveRosterGradeFields", () => {
  it("derives grade span from exact grade when span is omitted", () => {
    assert.deepEqual(resolveRosterGradeFields({ exact_grade: "5" }), {
      grade_span: "3-12",
      exact_grade: "5",
    });
  });

  it("accepts matching exact grade and grade span", () => {
    assert.deepEqual(
      resolveRosterGradeFields({ exact_grade: "2", grade_span: "1-2" }),
      {
        grade_span: "1-2",
        exact_grade: "2",
      },
    );
  });

  it("rejects conflicting exact grade and grade span", () => {
    assert.throws(
      () =>
        resolveRosterGradeFields({ exact_grade: "2", grade_span: "3-12" }),
      /conflicts/,
    );
  });

  it("stores null exact grade when only grade span is provided", () => {
    assert.deepEqual(resolveRosterGradeFields({ grade_span: "3-12" }), {
      grade_span: "3-12",
      exact_grade: null,
    });
  });
});
