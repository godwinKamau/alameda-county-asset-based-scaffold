-- Run as migrations_user

ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_log_authorized_by_type_check;

ALTER TABLE audit_log ADD CONSTRAINT audit_log_authorized_by_type_check
  CHECK (authorized_by_type IN
    ('grade_team','school_access','grade_grant','admin_role'));
