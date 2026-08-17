-- Run as migrations_user
-- grade_span is for ELPAC rubric only; access scope uses exact_grade or whole school.

ALTER TABLE grade_teams
  ALTER COLUMN grade_span DROP NOT NULL;
