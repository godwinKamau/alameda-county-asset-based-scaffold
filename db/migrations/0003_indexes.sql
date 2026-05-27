CREATE INDEX IF NOT EXISTS idx_roster_teacher_id
  ON student_roster_entries (teacher_id);

CREATE INDEX IF NOT EXISTS idx_sessions_teacher_student_submitted
  ON analysis_sessions (teacher_id, student_uuid, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_insights_session_id
  ON insights (session_id);

CREATE INDEX IF NOT EXISTS idx_audit_actor_occurred
  ON audit_log (actor_id, occurred_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roster_student_uuid
  ON student_roster_entries (student_uuid);
