-- Run as migrations_user

ALTER TABLE analysis_sessions
  ADD COLUMN IF NOT EXISTS evidence_kind TEXT NOT NULL DEFAULT 'written_artifact';

ALTER TABLE analysis_sessions ALTER COLUMN evidence_kind DROP DEFAULT;

ALTER TABLE analysis_sessions DROP CONSTRAINT IF EXISTS analysis_sessions_evidence_kind_check;
ALTER TABLE analysis_sessions ADD CONSTRAINT analysis_sessions_evidence_kind_check
  CHECK (evidence_kind IN ('written_artifact','audio_recording','observation_protocol','administered_task'));

ALTER TABLE analysis_sessions DROP CONSTRAINT IF EXISTS analysis_sessions_domain_evidence_check;
ALTER TABLE analysis_sessions ADD CONSTRAINT analysis_sessions_domain_evidence_check
  CHECK (
    NOT (domain = 'writing' AND evidence_kind = 'audio_recording')
    AND NOT (domain = 'speaking' AND evidence_kind = 'written_artifact')
    AND NOT (domain = 'listening' AND evidence_kind = 'written_artifact')
    AND NOT (domain = 'listening' AND evidence_kind = 'audio_recording')
  ) NOT VALID;

CREATE INDEX IF NOT EXISTS idx_sessions_student_domain_evidence
  ON analysis_sessions (student_uuid, domain, evidence_kind);
