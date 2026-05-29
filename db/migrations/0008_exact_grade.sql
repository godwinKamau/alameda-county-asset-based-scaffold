-- Run as migrations_user

ALTER TABLE student_roster_entries
  ADD COLUMN IF NOT EXISTS exact_grade TEXT CHECK (exact_grade IN (
    'K','1','2','3','4','5','6','7','8','9','10','11','12'
  ));

ALTER TABLE analysis_sessions
  ADD COLUMN IF NOT EXISTS exact_grade TEXT CHECK (exact_grade IN (
    'K','1','2','3','4','5','6','7','8','9','10','11','12'
  ));
