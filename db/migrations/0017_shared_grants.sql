-- Allow app_user to manage grade teams and school access grants

GRANT SELECT, INSERT, UPDATE ON grade_teams TO app_user;
GRANT SELECT, INSERT, UPDATE ON grade_team_members TO app_user;
