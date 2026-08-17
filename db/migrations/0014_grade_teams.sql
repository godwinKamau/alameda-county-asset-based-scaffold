-- Run as migrations_user

CREATE TABLE IF NOT EXISTS grade_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  name TEXT NOT NULL,
  grade_span TEXT NOT NULL CHECK (grade_span IN ('K','1-2','3-12')),
  exact_grade TEXT CHECK (exact_grade IN (
    'K','1','2','3','4','5','6','7','8','9','10','11','12'
  )),
  created_by UUID REFERENCES teacher_accounts(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS grade_team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES grade_teams(id),
  teacher_id UUID NOT NULL REFERENCES teacher_accounts(id),
  added_by UUID REFERENCES teacher_accounts(id),
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  UNIQUE (team_id, teacher_id)
);

CREATE INDEX IF NOT EXISTS idx_grade_team_members_teacher
  ON grade_team_members (teacher_id) WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_grade_teams_school
  ON grade_teams (school_id);
