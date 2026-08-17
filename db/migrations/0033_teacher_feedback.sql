-- Run as migrations_user

CREATE TABLE IF NOT EXISTS teacher_feedback (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id      UUID NOT NULL REFERENCES teacher_accounts(id),
  school_id       UUID NOT NULL REFERENCES schools(id),
  category        TEXT NOT NULL CHECK (category IN
                    ('bug','feature_request','confusing_ui','result_accuracy','other')),
  message         TEXT NOT NULL CHECK (char_length(message) BETWEEN 1 AND 2000),
  page_area       TEXT,
  grades_snapshot TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_feedback_created_at
  ON teacher_feedback (created_at DESC);

GRANT INSERT ON teacher_feedback TO app_user;
REVOKE SELECT, UPDATE, DELETE ON teacher_feedback FROM app_user;
