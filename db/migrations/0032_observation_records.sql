-- Run as migrations_user

CREATE TABLE IF NOT EXISTS observation_records (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id              UUID NOT NULL UNIQUE REFERENCES analysis_sessions(id) ON DELETE CASCADE,
  protocol_version        TEXT NOT NULL,
  observations            JSONB NOT NULL,
  derived_level           INT NOT NULL CHECK (derived_level BETWEEN 1 AND 4),
  coverage_ratio          REAL NOT NULL,
  confidence              TEXT NOT NULL CHECK (confidence IN ('high','moderate','low')),
  context_note_encrypted  TEXT,
  context_note_iv         TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

GRANT SELECT, INSERT, DELETE ON observation_records TO app_user;
