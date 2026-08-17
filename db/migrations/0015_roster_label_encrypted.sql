-- Run as migrations_user

ALTER TABLE student_roster_entries
  ADD COLUMN IF NOT EXISTS label_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS label_iv TEXT;
