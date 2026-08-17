-- Run as migrations_user

CREATE TABLE IF NOT EXISTS grade_grants (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    UUID NOT NULL REFERENCES teacher_accounts(id),
  school_id     UUID NOT NULL REFERENCES schools(id),
  exact_grade   TEXT CHECK (exact_grade IN
                  ('K','1','2','3','4','5','6','7','8','9','10','11','12')),
  granted_by    UUID REFERENCES teacher_accounts(id),
  granted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ,
  revoked_by    UUID REFERENCES teacher_accounts(id),
  origin        TEXT NOT NULL DEFAULT 'admin'
                  CHECK (origin IN ('admin','request','migrated')),
  request_id    UUID,
  note          TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_grade_grants_active_unique
  ON grade_grants (teacher_id, school_id, COALESCE(exact_grade, '*'))
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_grade_grants_lookup
  ON grade_grants (teacher_id, school_id, exact_grade)
  WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON grade_grants TO app_user;
