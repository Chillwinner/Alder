-- 工作空间协作页：备忘录 + fileshare 目录（需手动执行一次）

ALTER TABLE sys_workspace
    ADD COLUMN IF NOT EXISTS fileshare_folder_id VARCHAR(32);

CREATE TABLE IF NOT EXISTS workspace_memo
(
    id           VARCHAR(32) PRIMARY KEY,
    workspace_id VARCHAR(32)  NOT NULL,
    title        VARCHAR(200) NOT NULL DEFAULT '未命名备忘录',
    created_by   VARCHAR(32)  NOT NULL,
    visibility   VARCHAR(16)  NOT NULL DEFAULT 'shared',
    body_html    TEXT,
    body_md      TEXT,
    sort_order   INT          NOT NULL DEFAULT 0,
    pinned       BOOLEAN      NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP    NOT NULL DEFAULT NOW(),
    deleted_at   TIMESTAMP
);

ALTER TABLE workspace_memo
    ADD COLUMN IF NOT EXISTS visibility VARCHAR(16) NOT NULL DEFAULT 'shared';
ALTER TABLE workspace_memo
    ADD COLUMN IF NOT EXISTS body_html TEXT;
ALTER TABLE workspace_memo
    ADD COLUMN IF NOT EXISTS body_md TEXT;
ALTER TABLE workspace_memo
    ADD COLUMN IF NOT EXISTS file_id VARCHAR(32);

CREATE INDEX IF NOT EXISTS idx_workspace_memo_ws ON workspace_memo (workspace_id, deleted_at, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_memo_vis
    ON workspace_memo (workspace_id, visibility, created_by, deleted_at);

CREATE TABLE IF NOT EXISTS workspace_memo_snapshot
(
    id              BIGSERIAL PRIMARY KEY,
    memo_id         VARCHAR(32)  NOT NULL,
    yjs_state       BYTEA,
    content_hash    VARCHAR(64),
    commit_message  VARCHAR(200),
    saved_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);

ALTER TABLE workspace_memo_snapshot
    ADD COLUMN IF NOT EXISTS commit_message VARCHAR(200);

CREATE INDEX IF NOT EXISTS idx_workspace_memo_snapshot_memo ON workspace_memo_snapshot (memo_id, saved_at DESC);

CREATE TABLE IF NOT EXISTS workspace_board_pinned_file
(
    workspace_id VARCHAR(32) NOT NULL,
    file_id      VARCHAR(32) NOT NULL,
    pinned_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    PRIMARY KEY (workspace_id, file_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_board_pinned_ws ON workspace_board_pinned_file (workspace_id, pinned_at);

CREATE TABLE IF NOT EXISTS workspace_vote
(
    id           VARCHAR(32) PRIMARY KEY,
    workspace_id VARCHAR(32)  NOT NULL,
    title        VARCHAR(200) NOT NULL,
    created_by   VARCHAR(32)  NOT NULL,
    created_at   TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_vote_ws ON workspace_vote (workspace_id, created_at DESC);

CREATE TABLE IF NOT EXISTS workspace_vote_participant
(
    vote_id   VARCHAR(32) NOT NULL,
    user_id   VARCHAR(32) NOT NULL,
    choice    VARCHAR(16),
    voted_at  TIMESTAMP,
    PRIMARY KEY (vote_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_vote_participant_user
    ON workspace_vote_participant (user_id, choice);
