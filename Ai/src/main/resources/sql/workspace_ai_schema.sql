CREATE TABLE IF NOT EXISTS workspace_ai_settings
(
    workspace_id  VARCHAR(32) PRIMARY KEY,
    enabled       BOOLEAN      NOT NULL DEFAULT TRUE,
    base_url      VARCHAR(500) NOT NULL DEFAULT 'https://api.deepseek.com',
    model_name    VARCHAR(128) NOT NULL DEFAULT 'deepseek-flash',
    api_key       TEXT,
    custom_prompt TEXT,
    updated_by    VARCHAR(32),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspace_ai_reminder
(
    id            VARCHAR(32) PRIMARY KEY,
    workspace_id  VARCHAR(32) NOT NULL,
    user_id       VARCHAR(32) NOT NULL,
    message       TEXT        NOT NULL,
    kind          VARCHAR(16) NOT NULL,
    hour          SMALLINT    NOT NULL,
    minute        SMALLINT    NOT NULL,
    once_date     DATE,
    weekdays      VARCHAR(32),
    biweek_parity VARCHAR(8),
    anchor_monday DATE,
    enabled       BOOLEAN     NOT NULL DEFAULT TRUE,
    next_fire_at  TIMESTAMPTZ,
    created_at    TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_ai_reminder_due
    ON workspace_ai_reminder (enabled, next_fire_at);

CREATE TABLE IF NOT EXISTS workspace_ai_reminder_inbox
(
    id           VARCHAR(32) PRIMARY KEY,
    reminder_id  VARCHAR(32) NOT NULL,
    workspace_id VARCHAR(32) NOT NULL,
    user_id      VARCHAR(32) NOT NULL,
    message      TEXT        NOT NULL,
    fired_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dismissed    BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_workspace_ai_reminder_inbox_user
    ON workspace_ai_reminder_inbox (user_id, dismissed);

ALTER TABLE sys_workspace
    ADD COLUMN IF NOT EXISTS rag_folder_id VARCHAR(32);

CREATE TABLE IF NOT EXISTS workspace_ai_rag_doc
(
    id           VARCHAR(32) PRIMARY KEY,
    workspace_id VARCHAR(32) NOT NULL,
    file_id      VARCHAR(32) NOT NULL,
    display_name VARCHAR(512) NOT NULL,
    char_count   INTEGER     NOT NULL DEFAULT 0,
    chunk_count  INTEGER     NOT NULL DEFAULT 0,
    indexed_at   TIMESTAMP   NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_ai_rag_doc_ws
    ON workspace_ai_rag_doc (workspace_id);
