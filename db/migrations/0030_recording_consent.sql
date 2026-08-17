-- Run as migrations_user

ALTER TABLE districts
  ADD COLUMN IF NOT EXISTS audio_recording_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS student_recording_consent (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_uuid  UUID NOT NULL REFERENCES student_roster_entries(student_uuid) ON DELETE CASCADE,
  status        TEXT NOT NULL CHECK (status IN ('granted','denied')),
  source        TEXT NOT NULL CHECK (source IN ('district_agreement','signed_form_on_file','other')),
  note_encrypted TEXT,
  note_iv        TEXT,
  recorded_by   UUID NOT NULL REFERENCES teacher_accounts(id),
  recorded_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at    TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_recording_consent_active
  ON student_recording_consent (student_uuid) WHERE revoked_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON student_recording_consent TO app_user;
