-- Allow app_user to read, save, and unsave scaffold insights

GRANT SELECT, INSERT, DELETE ON saved_insights TO app_user;
