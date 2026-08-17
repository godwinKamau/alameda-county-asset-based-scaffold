-- Run as migrations_user

ALTER TABLE audit_log
  ADD COLUMN IF NOT EXISTS authorized_by UUID,
  ADD COLUMN IF NOT EXISTS authorized_by_type TEXT
    CHECK (authorized_by_type IN ('grade_team','school_access'));
