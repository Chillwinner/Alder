ALTER TABLE file_collections ADD COLUMN IF NOT EXISTS assignee_user_ids TEXT;
ALTER TABLE file_collection_submissions ADD COLUMN IF NOT EXISTS submitter_user_id VARCHAR(32);
