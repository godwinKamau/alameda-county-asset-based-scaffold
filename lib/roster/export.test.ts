import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyDomainLevels } from "@/lib/elpac/domain";
import {
  buildRosterScoresCsv,
  type RosterScoreExportEntry,
} from "./export.ts";

function makeEntry(
  overrides: Partial<RosterScoreExportEntry> & Pick<RosterScoreExportEntry, "label">,
): RosterScoreExportEntry {
  return {
    student_uuid: overrides.student_uuid ?? "00000000-0000-4000-8000-000000000001",
    label: overrides.label,
    exact_grade: overrides.exact_grade ?? "1",
    session_count: overrides.session_count ?? 0,
    avg_level: overrides.avg_level ?? null,
    domain_levels: overrides.domain_levels ?? emptyDomainLevels(),
    latest_analysis: overrides.latest_analysis ?? null,
  };
}

describe("buildRosterScoresCsv", () => {
  it("exports real names and blank scores", () => {
    const csv = buildRosterScoresCsv(
      [
        makeEntry({
          label: "Pop pop",
          session_count: 7,
          avg_level: 2.4,
          domain_levels: {
            listening: null,
            speaking: null,
            reading: null,
            writing: 2.4,
          },
          latest_analysis: {
            domain: "writing",
            estimated_level: 3,
            submitted_at: "2026-05-29T12:45:22.000Z",
          },
        }),
      ],
      {
        groups: [{ name: "Period 1", members: [{ student_uuid: "00000000-0000-4000-8000-000000000001" }] }],
      },
    );

    assert.match(csv, /^name,grade,category,total_analyses,latest_analysis_date,/);
    assert.match(
      csv,
      /Pop pop,Grade 1,Period 1,7,2026-05-29,writing,3,2\.4,,,,2\.4/,
    );
  });

  it("includes latest analysis columns when present", () => {
    const csv = buildRosterScoresCsv([
      makeEntry({
        label: "Amy",
        session_count: 2,
        latest_analysis: {
          domain: "reading",
          estimated_level: 2,
          submitted_at: "2026-01-15T10:30:00.000Z",
        },
      }),
    ]);

    assert.match(csv, /Amy,Grade 1,Ungrouped,2,2026-01-15,reading,2,,,,,/);
  });

  it("uses Ungrouped when a student has no teacher category", () => {
    const csv = buildRosterScoresCsv([makeEntry({ label: "Amy" })]);

    assert.match(csv, /Amy,Grade 1,Ungrouped,0,,,,,,,,/);
  });

  it("scrubs names to Student A, Student B, Student C", () => {
    const csv = buildRosterScoresCsv(
      [
        makeEntry({ label: "Charlie" }),
        makeEntry({ label: "Alice" }),
        makeEntry({ label: "Bob" }),
      ],
      { scrubNames: true },
    );

    const lines = csv.trim().split("\n");
    assert.equal(lines.length, 4);
    assert.match(lines[1]!, /^Student A,/);
    assert.match(lines[2]!, /^Student B,/);
    assert.match(lines[3]!, /^Student C,/);
  });

  it("quotes names that contain commas", () => {
    const csv = buildRosterScoresCsv([
      makeEntry({ label: "Last, First" }),
    ]);

    assert.match(csv, /"Last, First"/);
  });

  it("sorts rows alphabetically before scrub labels are assigned", () => {
    const csv = buildRosterScoresCsv(
      [
        makeEntry({ label: "Zed" }),
        makeEntry({ label: "Amy" }),
      ],
      { scrubNames: true },
    );

    const lines = csv.trim().split("\n");
    assert.match(lines[1]!, /^Student A,/);
    assert.match(lines[2]!, /^Student B,/);
  });
});
