ALTER TABLE sys_workspace
    ADD COLUMN IF NOT EXISTS local_quota_bytes BIGINT DEFAULT 5368709120;

UPDATE sys_workspace
SET local_quota_bytes = 5368709120
WHERE local_quota_bytes IS NULL;
