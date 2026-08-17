import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  buildDomainEvidenceCheckSql,
  EVIDENCE_VALIDITY,
  evidenceValidity,
  invalidEvidencePairs,
  isValidEvidence,
  primaryEvidenceKinds,
  recommendedEvidenceKind,
} from "./evidence.ts";

describe("EVIDENCE_VALIDITY matrix", () => {
  it("every domain has at least one primary kind", () => {
    for (const domain of Object.keys(EVIDENCE_VALIDITY)) {
      assert.ok(primaryEvidenceKinds(domain as keyof typeof EVIDENCE_VALIDITY).length >= 1);
    }
  });

  it("rejects written artifact for oral production domains", () => {
    assert.equal(evidenceValidity("speaking", "written_artifact"), "invalid");
    assert.equal(evidenceValidity("listening", "written_artifact"), "invalid");
  });

  it("accepts audio as supporting for reading", () => {
    assert.equal(evidenceValidity("reading", "audio_recording"), "supporting");
  });

  it("rejects audio for listening", () => {
    assert.equal(evidenceValidity("listening", "audio_recording"), "invalid");
  });

  it("recommends observation protocol for K-2 speaking", () => {
    assert.equal(recommendedEvidenceKind("speaking", "K"), "observation_protocol");
    assert.equal(recommendedEvidenceKind("speaking", "1-2"), "observation_protocol");
  });

  it("isValidEvidence excludes invalid pairs", () => {
    assert.equal(isValidEvidence("writing", "audio_recording"), false);
    assert.equal(isValidEvidence("writing", "written_artifact"), true);
  });
});

describe("buildDomainEvidenceCheckSql", () => {
  it("matches migration 0029 constraint body", () => {
    const migrationPath = join(
      process.cwd(),
      "db/migrations/0029_session_evidence_kind.sql",
    );
    const sql = readFileSync(migrationPath, "utf8");
    const match = sql.match(
      /analysis_sessions_domain_evidence_check\s+CHECK\s*\(\s*([\s\S]*?)\s*\)\s*NOT VALID/i,
    );
    assert.ok(match, "expected NOT VALID CHECK in migration");
    const normalizedMigration = match[1]
      .replace(/\s+/g, " ")
      .trim();
    const generated = buildDomainEvidenceCheckSql().replace(/\s+/g, " ").trim();
    assert.equal(normalizedMigration, generated);
  });

  it("lists every invalid pair", () => {
    const pairs = invalidEvidencePairs();
    assert.ok(pairs.some((p) => p.domain === "speaking" && p.kind === "written_artifact"));
    assert.ok(pairs.some((p) => p.domain === "listening" && p.kind === "audio_recording"));
  });
});
