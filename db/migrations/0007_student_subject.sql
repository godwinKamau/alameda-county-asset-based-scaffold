-- Run as migrations_user

ALTER TABLE student_roster_entries
  ADD COLUMN IF NOT EXISTS subject TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_roster_teacher_subject
  ON student_roster_entries (teacher_id, subject);
