-- Run as migrations_user

ALTER TABLE student_roster_entries
  ADD COLUMN IF NOT EXISTS school_id UUID REFERENCES schools(id);

UPDATE student_roster_entries r
SET school_id = t.school_id
FROM teacher_accounts t
WHERE t.id = r.teacher_id
  AND r.school_id IS NULL;

ALTER TABLE student_roster_entries
  ALTER COLUMN school_id SET NOT NULL;

ALTER TABLE student_roster_entries
  ALTER COLUMN teacher_id DROP NOT NULL;

COMMENT ON COLUMN student_roster_entries.teacher_id IS
  'Provenance only (creating teacher/admin). Not an authorization input as of 0022.';

CREATE INDEX IF NOT EXISTS idx_roster_school_grade
  ON student_roster_entries (school_id, exact_grade);
