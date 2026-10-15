CREATE TABLE IF NOT EXISTS lan_transfer_session
(
    id            VARCHAR(32) PRIMARY KEY,
    from_user_id  VARCHAR(32)  NOT NULL,
    to_user_id    VARCHAR(32)  NOT NULL,
    files_json    TEXT         NOT NULL,
    status        VARCHAR(16)  NOT NULL DEFAULT 'PENDING',
    created_at    TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lan_transfer_to_status
    ON lan_transfer_session (to_user_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lan_transfer_from
    ON lan_transfer_session (from_user_id, created_at DESC);
