-- Run as migrations_user
-- Destructive: drops legacy sharing tables. Snapshot the database first.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM grade_grants LIMIT 1) THEN
    RAISE EXCEPTION '0028 blocked: grade_grants is empty';
  END IF;

  IF EXISTS (
    SELECT 1 FROM school_access sa
    WHERE sa.revoked_at IS NULL
      AND (sa.expires_at IS NULL OR sa.expires_at > NOW())
      AND NOT EXISTS (
        SELECT 1 FROM grade_grants g
        WHERE g.teacher_id = sa.teacher_id
          AND g.school_id = sa.school_id
          AND COALESCE(g.exact_grade, '*') = COALESCE(sa.exact_grade, '*')
          AND g.revoked_at IS NULL
      )
  ) THEN
    RAISE EXCEPTION '0028 blocked: active school_access rows lack grade_grants parity';
  END IF;
END $$;

DROP TABLE IF EXISTS grade_team_members;
DROP TABLE IF EXISTS grade_teams;
DROP TABLE IF EXISTS school_access;
