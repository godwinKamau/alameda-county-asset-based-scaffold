-- Idempotent role creation and grants (run as migrations_user / superuser)

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'migrations_user') THEN
    CREATE ROLE migrations_user WITH LOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    CREATE ROLE app_user WITH LOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO app_user;
GRANT USAGE ON SCHEMA public TO migrations_user;

GRANT SELECT, INSERT, UPDATE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT INSERT ON audit_log TO app_user;
REVOKE UPDATE, DELETE ON audit_log FROM app_user;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO migrations_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO migrations_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE ON TABLES TO app_user;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO migrations_user;
