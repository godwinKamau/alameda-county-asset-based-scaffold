CREATE TABLE saved_insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teacher_accounts(id),
  session_id UUID NOT NULL REFERENCES analysis_sessions(id),
  item_index INT NOT NULL CHECK (item_index >= 0),
  scaffold_text_encrypted TEXT NOT NULL,
  scaffold_text_iv TEXT NOT NULL,
  scaffold_sources JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (teacher_id, session_id, item_index)
);

CREATE INDEX saved_insights_teacher_created_idx
  ON saved_insights (teacher_id, created_at DESC);
