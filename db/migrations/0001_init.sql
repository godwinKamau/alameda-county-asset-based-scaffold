-- Run as migrations_user

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE districts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  state_code CHAR(2) NOT NULL DEFAULT 'CA',
  ca_cds_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE schools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  district_id UUID NOT NULL REFERENCES districts(id),
  name TEXT NOT NULL,
  nces_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE teacher_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id UUID NOT NULL REFERENCES schools(id),
  email_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher','eld_coordinator','admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_active_at TIMESTAMPTZ
);

CREATE TABLE school_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teacher_accounts(id),
  school_id UUID NOT NULL REFERENCES schools(id),
  access_level TEXT NOT NULL DEFAULT 'read' CHECK (access_level IN ('read','write')),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by UUID REFERENCES teacher_accounts(id),
  UNIQUE(teacher_id, school_id)
);

CREATE TABLE student_roster_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teacher_accounts(id),
  student_uuid UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  grade_span TEXT NOT NULL CHECK (grade_span IN ('K','1-2','3-12')),
  known_elpac_level INT CHECK (known_elpac_level BETWEEN 1 AND 4),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE analysis_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES teacher_accounts(id),
  student_uuid UUID NOT NULL REFERENCES student_roster_entries(student_uuid),
  domain TEXT NOT NULL DEFAULT 'writing' CHECK (domain IN ('writing','reading')),
  grade_span TEXT NOT NULL CHECK (grade_span IN ('K','1-2','3-12')),
  provided_elpac_level INT CHECK (provided_elpac_level BETWEEN 1 AND 4),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE insights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL UNIQUE REFERENCES analysis_sessions(id),
  strengths_encrypted TEXT NOT NULL,
  strengths_iv TEXT NOT NULL,
  estimated_level INT NOT NULL CHECK (estimated_level BETWEEN 1 AND 4),
  level_reasoning_encrypted TEXT NOT NULL,
  level_reasoning_iv TEXT NOT NULL,
  gap_to_next_encrypted TEXT NOT NULL,
  gap_to_next_iv TEXT NOT NULL,
  scaffold_encrypted TEXT NOT NULL,
  scaffold_iv TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES teacher_accounts(id),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  ip_hash TEXT,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
