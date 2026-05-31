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

  it("includes domain when provided", () => {
    const url = buildAnalyzeUrl({
      student_uuid: "abc-123",
      subject: "",
      grade_span: "3-12",
      known_elpac_level: null,
      domain: "reading",
    });

    assert.equal(url, "/analyze?student=abc-123&grade_span=3-12&domain=reading");
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
      domain: "writing",
    });
  });

  it("reads domain from query params", () => {
    const params = new URLSearchParams(
      "student=abc-123&grade_span=3-12&domain=reading",
    );

    assert.deepEqual(parseAnalyzePrefill(params), {
      studentUuid: "abc-123",
      subject: "All",
      gradeSpan: "3-12",
      providedLevel: "",
      domain: "reading",
    });
  });

  it("defaults domain to writing when missing or invalid", () => {
    assert.deepEqual(
      parseAnalyzePrefill(new URLSearchParams("student=abc-123&domain=invalid")),
      {
        studentUuid: "abc-123",
        subject: "All",
        gradeSpan: "3-12",
        providedLevel: "",
        domain: "writing",
      },
    );
  });

  it("returns null without a student param", () => {
    assert.equal(parseAnalyzePrefill(new URLSearchParams()), null);
  });
});
