import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildAnalyzeUrl, parseAnalyzePrefill } from "./url";

describe("buildAnalyzeUrl", () => {
  it("includes student settings in query params", () => {
    const url = buildAnalyzeUrl({
      student_uuid: "abc-123",
      subject: "Reading - Period 3",
      grade_span: "1-2",
      known_elpac_level: 2,
    });

    assert.equal(
      url,
      "/analyze?student=abc-123&subject=Reading+-+Period+3&grade_span=1-2&level=2",
    );
  });

  it("omits level when not known", () => {
    const url = buildAnalyzeUrl({
      student_uuid: "abc-123",
      subject: "",
      grade_span: "3-12",
      known_elpac_level: null,
    });

    assert.equal(url, "/analyze?student=abc-123&grade_span=3-12");
  });
});

describe("parseAnalyzePrefill", () => {
  it("reads analyze prefill params", () => {
    const params = new URLSearchParams(
      "student=abc-123&subject=Reading+-+Period+3&grade_span=1-2&level=2",
    );

    assert.deepEqual(parseAnalyzePrefill(params), {
      studentUuid: "abc-123",
      subject: "Reading - Period 3",
      gradeSpan: "1-2",
      providedLevel: "2",
    });
  });

  it("returns null without a student param", () => {
    assert.equal(parseAnalyzePrefill(new URLSearchParams()), null);
  });
});
