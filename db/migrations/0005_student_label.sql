-- Run as migrations_user

ALTER TABLE student_roster_entries
  ADD COLUMN IF NOT EXISTS label TEXT NOT NULL DEFAULT '';
