-- Allow app_user to remove roster entries and dependent analysis data

GRANT DELETE ON insights TO app_user;
GRANT DELETE ON analysis_sessions TO app_user;
GRANT DELETE ON student_roster_entries TO app_user;
