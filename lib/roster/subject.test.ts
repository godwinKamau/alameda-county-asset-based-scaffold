import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  collectExistingSubjects,
  filterSubjectSuggestions,
  matchExistingSubject,
  subjectComparisonKey,
} from "./subject";

describe("subjectComparisonKey", () => {
  it("normalizes case, spacing, and punctuation", () => {
    assert.equal(subjectComparisonKey("ELA - Period 3"), "ela period 3");
    assert.equal(subjectComparisonKey("ela  period   3"), "ela period 3");
    assert.equal(subjectComparisonKey("ELA-Period_3"), "ela period 3");
  });
});

describe("matchExistingSubject", () => {
  const existing = ["ELA - Period 3", "AP Biology"];

  it("returns canonical subject for similar input", () => {
    assert.equal(matchExistingSubject("ela period 3", existing), "ELA - Period 3");
    assert.equal(matchExistingSubject("AP-Biology", existing), "AP Biology");
  });

  it("returns trimmed input when no match exists", () => {
    assert.equal(matchExistingSubject("  Chemistry  ", existing), "Chemistry");
  });

  it("returns empty string for blank input", () => {
    assert.equal(matchExistingSubject("   ", existing), "");
  });
});

describe("filterSubjectSuggestions", () => {
  const existing = ["ELA - Period 3", "AP Biology", "Math - Period 1"];

  it("returns all subjects when query is empty", () => {
    assert.deepEqual(filterSubjectSuggestions("", existing, 2), [
      "AP Biology",
      "ELA - Period 3",
    ]);
  });

  it("filters by normalized partial match", () => {
    assert.deepEqual(filterSubjectSuggestions("ela", existing), [
      "ELA - Period 3",
    ]);
    assert.deepEqual(filterSubjectSuggestions("period", existing), [
      "ELA - Period 3",
      "Math - Period 1",
    ]);
  });
});

describe("collectExistingSubjects", () => {
  it("deduplicates similar subjects and keeps first canonical form", () => {
    assert.deepEqual(
      collectExistingSubjects(["ELA - Period 3", "ela period 3", "", "AP Bio"]),
      ["AP Bio", "ELA - Period 3"],
    );
  });
});
