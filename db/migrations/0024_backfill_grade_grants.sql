-- Run as migrations_user

-- Self-grants from existing roster ownership
INSERT INTO grade_grants (teacher_id, school_id, exact_grade, granted_by, origin, note)
SELECT DISTINCT r.teacher_id, r.school_id, r.exact_grade, NULL::uuid, 'migrated',
       'Auto-granted from pre-existing roster ownership'
FROM student_roster_entries r
WHERE r.teacher_id IS NOT NULL
  AND r.exact_grade IS NOT NULL
ON CONFLICT DO NOTHING;

-- From active school_access grants
INSERT INTO grade_grants (teacher_id, school_id, exact_grade, granted_by, origin, note, expires_at)
SELECT sa.teacher_id, sa.school_id, sa.exact_grade, sa.granted_by, 'migrated',
       COALESCE(sa.note, 'Migrated from school_access'),
       sa.expires_at
FROM school_access sa
WHERE sa.revoked_at IS NULL
  AND (sa.expires_at IS NULL OR sa.expires_at > NOW())
ON CONFLICT DO NOTHING;

-- From grade team memberships (grade-scoped teams)
INSERT INTO grade_grants (teacher_id, school_id, exact_grade, granted_by, origin, note)
SELECT DISTINCT gtm.teacher_id, gt.school_id, gt.exact_grade, gt.created_by, 'migrated',
       'Migrated from grade team: ' || gt.name
FROM grade_team_members gtm
JOIN grade_teams gt ON gt.id = gtm.team_id
WHERE gtm.revoked_at IS NULL
  AND gt.exact_grade IS NOT NULL
ON CONFLICT DO NOTHING;

-- From grade team memberships (whole-school teams)
INSERT INTO grade_grants (teacher_id, school_id, exact_grade, granted_by, origin, note)
SELECT DISTINCT gtm.teacher_id, gt.school_id, NULL::text, gt.created_by, 'migrated',
       'Migrated from whole-school grade team: ' || gt.name
FROM grade_team_members gtm
JOIN grade_teams gt ON gt.id = gtm.team_id
WHERE gtm.revoked_at IS NULL
  AND gt.exact_grade IS NULL
ON CONFLICT DO NOTHING;
