-- Run as migrations_user

ALTER TABLE school_access
  ADD COLUMN IF NOT EXISTS grade_span TEXT CHECK (grade_span IN ('K','1-2','3-12')),
  ADD COLUMN IF NOT EXISTS exact_grade TEXT CHECK (exact_grade IN (
    'K','1','2','3','4','5','6','7','8','9','10','11','12'
  )),
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS note TEXT;

-- grade_span NULL = whole-school (principal-style) grant.
-- Allow multiple grade-scoped grants per (teacher, school).
ALTER TABLE school_access
  DROP CONSTRAINT IF EXISTS school_access_teacher_id_school_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_school_access_teacher_school_grade
  ON school_access (teacher_id, school_id, grade_span, exact_grade);

CREATE INDEX IF NOT EXISTS idx_school_access_teacher_active
  ON school_access (teacher_id) WHERE revoked_at IS NULL;
