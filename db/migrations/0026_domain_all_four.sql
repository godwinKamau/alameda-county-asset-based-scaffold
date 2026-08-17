-- Run as migrations_user

ALTER TABLE analysis_sessions DROP CONSTRAINT IF EXISTS analysis_sessions_domain_check;
ALTER TABLE analysis_sessions ADD CONSTRAINT analysis_sessions_domain_check
  CHECK (domain IN ('listening','speaking','reading','writing'));

CREATE INDEX IF NOT EXISTS idx_sessions_student_domain
  ON analysis_sessions (student_uuid, domain, teacher_id);
