-- Run as migrations_user

CREATE TABLE IF NOT EXISTS grade_access_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id              UUID NOT NULL REFERENCES teacher_accounts(id),
  school_id               UUID NOT NULL REFERENCES schools(id),
  exact_grade             TEXT CHECK (exact_grade IN
                            ('K','1','2','3','4','5','6','7','8','9','10','11','12')),
  reason_encrypted        TEXT,
  reason_iv               TEXT,
  status                  TEXT NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending','approved','denied','withdrawn')),
  requested_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at              TIMESTAMPTZ,
  decided_by              UUID REFERENCES teacher_accounts(id),
  decision_note_encrypted TEXT,
  decision_note_iv        TEXT,
  CONSTRAINT grade_access_requests_decided_ck
    CHECK ((status = 'pending') = (decided_at IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_access_requests_one_pending
  ON grade_access_requests (teacher_id, school_id, COALESCE(exact_grade, '*'))
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_access_requests_queue
  ON grade_access_requests (school_id, requested_at DESC)
  WHERE status = 'pending';

GRANT SELECT, INSERT, UPDATE ON grade_access_requests TO app_user;

ALTER TABLE grade_grants
  ADD CONSTRAINT grade_grants_request_fk
  FOREIGN KEY (request_id) REFERENCES grade_access_requests(id);
