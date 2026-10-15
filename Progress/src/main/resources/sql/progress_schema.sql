CREATE TABLE IF NOT EXISTS progress_task
(
    id           VARCHAR(32) PRIMARY KEY,
    workspace_id VARCHAR(32)  NOT NULL,
    title        VARCHAR(200) NOT NULL,
    description  TEXT,
    kind         VARCHAR(16)  NOT NULL,
    status       VARCHAR(16)  NOT NULL DEFAULT 'TODO',
    progress     INT          NOT NULL DEFAULT 0,
    due_at       TIMESTAMP,
    created_by   VARCHAR(32)  NOT NULL,
    note         TEXT,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_progress_task_ws
    ON progress_task (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS progress_assignee
(
    task_id VARCHAR(32) NOT NULL,
    user_id VARCHAR(32) NOT NULL,
    PRIMARY KEY (task_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_progress_assignee_user
    ON progress_assignee (user_id, task_id);

CREATE TABLE IF NOT EXISTS progress_submission
(
    id             VARCHAR(32) PRIMARY KEY,
    task_id        VARCHAR(32) NOT NULL,
    user_id        VARCHAR(32) NOT NULL,
    day            DATE,
    progress_before INT        NOT NULL DEFAULT 0,
    progress_after  INT        NOT NULL DEFAULT 0,
    review_status  VARCHAR(16) NOT NULL DEFAULT 'NONE',
    note           TEXT,
    created_at     TIMESTAMP   NOT NULL DEFAULT NOW()
);

ALTER TABLE progress_task ADD COLUMN IF NOT EXISTS note TEXT;
ALTER TABLE progress_submission ADD COLUMN IF NOT EXISTS note TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS uk_progress_daily
    ON progress_submission (task_id, day)
    WHERE day IS NOT NULL;

CREATE TABLE IF NOT EXISTS progress_submission_file
(
    submission_id VARCHAR(32) NOT NULL,
    file_id       VARCHAR(32) NOT NULL,
    PRIMARY KEY (submission_id, file_id)
);
