-- Run as migrations_user
-- Apply only after scripts/backfill-label-encryption.ts has been run and verified.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM student_roster_entries WHERE label_encrypted IS NULL OR label_iv IS NULL
  ) THEN
    RAISE EXCEPTION
      '0018 blocked: student_roster_entries still has NULL label_encrypted/label_iv. Run: npm run backfill-labels';
  END IF;
END $$;

ALTER TABLE student_roster_entries DROP COLUMN IF EXISTS label;

ALTER TABLE student_roster_entries
  ALTER COLUMN label_encrypted SET NOT NULL,
  ALTER COLUMN label_iv SET NOT NULL;
