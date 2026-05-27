-- Bootstrap default district and school for teacher onboarding (MVP)
INSERT INTO districts (id, name, state_code)
VALUES ('00000000-0000-4000-8000-000000000001', 'Default District', 'CA')
ON CONFLICT (id) DO NOTHING;

INSERT INTO schools (id, district_id, name)
VALUES (
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'Default School'
)
ON CONFLICT (id) DO NOTHING;
