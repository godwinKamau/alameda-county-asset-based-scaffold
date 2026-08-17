-- Run as migrations_user
-- Apply only after the admin "Needs grade" queue has been cleared.
-- Legacy rows with grade_span but no exact_grade are backfilled to the
-- lowest grade in the span so migration can proceed; admins may correct later.

UPDATE student_roster_entries
SET exact_grade = CASE grade_span
  WHEN 'K' THEN 'K'
  WHEN '1-2' THEN '1'
  WHEN '3-12' THEN '3'
END,
last_updated_at = NOW()
WHERE exact_grade IS NULL
  AND grade_span IN ('K', '1-2', '3-12');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM student_roster_entries WHERE exact_grade IS NULL
  ) THEN
    RAISE EXCEPTION
      '0021 blocked: student_roster_entries still has NULL exact_grade. Clear the admin "Needs grade" queue first.';
  END IF;
END $$;

ALTER TABLE student_roster_entries
  ALTER COLUMN exact_grade SET NOT NULL;
