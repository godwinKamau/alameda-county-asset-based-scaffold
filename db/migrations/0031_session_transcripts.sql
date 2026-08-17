-- Run as migrations_user

CREATE TABLE IF NOT EXISTS session_transcripts (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           UUID NOT NULL UNIQUE REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  transcript_encrypted TEXT NOT NULL,
  transcript_iv        TEXT NOT NULL,
  edited_by_teacher    BOOLEAN NOT NULL DEFAULT FALSE,
  fluency_metrics      JSONB NOT NULL,
  asr_provider         TEXT NOT NULL,
  asr_mean_confidence  REAL,
  duration_seconds     REAL NOT NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  purge_after          TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '180 days'
);

CREATE INDEX IF NOT EXISTS idx_session_transcripts_purge
  ON session_transcripts (purge_after);

GRANT SELECT, INSERT, DELETE ON session_transcripts TO app_user;
