ALTER TABLE saved_insights ADD COLUMN content_hash TEXT;

UPDATE saved_insights SET content_hash = id::text WHERE content_hash IS NULL;

ALTER TABLE saved_insights ALTER COLUMN content_hash SET NOT NULL;

ALTER TABLE saved_insights
  DROP CONSTRAINT saved_insights_teacher_id_session_id_item_index_key;

ALTER TABLE saved_insights
  ADD CONSTRAINT saved_insights_teacher_id_session_id_content_hash_key
  UNIQUE (teacher_id, session_id, content_hash);
