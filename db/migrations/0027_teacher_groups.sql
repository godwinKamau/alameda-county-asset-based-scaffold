-- Run as migrations_user

CREATE TABLE IF NOT EXISTS teacher_student_groups (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id     UUID NOT NULL REFERENCES teacher_accounts(id),
  name_encrypted TEXT NOT NULL,
  name_iv        TEXT NOT NULL,
  position       INT  NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teacher_groups_owner
  ON teacher_student_groups (teacher_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_student_groups TO app_user;

CREATE TABLE IF NOT EXISTS teacher_student_group_members (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id     UUID NOT NULL REFERENCES teacher_student_groups(id) ON DELETE CASCADE,
  teacher_id   UUID NOT NULL REFERENCES teacher_accounts(id),
  student_uuid UUID NOT NULL REFERENCES student_roster_entries(student_uuid) ON DELETE CASCADE,
  position     INT  NOT NULL DEFAULT 0,
  added_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT tsgm_one_group_per_teacher UNIQUE (teacher_id, student_uuid)
);

CREATE INDEX IF NOT EXISTS idx_group_members_ordering
  ON teacher_student_group_members (group_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON teacher_student_group_members TO app_user;

CREATE TABLE IF NOT EXISTS teacher_hidden_students (
  teacher_id   UUID NOT NULL REFERENCES teacher_accounts(id),
  student_uuid UUID NOT NULL REFERENCES student_roster_entries(student_uuid) ON DELETE CASCADE,
  hidden_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (teacher_id, student_uuid)
);

GRANT SELECT, INSERT, DELETE ON teacher_hidden_students TO app_user;
