CREATE TABLE IF NOT EXISTS workspace_meeting
(
    id               VARCHAR(32) PRIMARY KEY,
    workspace_id     VARCHAR(32)  NOT NULL,
    room_id          VARCHAR(32)  NOT NULL,
    title            VARCHAR(200) NOT NULL,
    starts_at        TIMESTAMPTZ  NOT NULL,
    created_by       VARCHAR(32)  NOT NULL,
    invite_pushed_at TIMESTAMPTZ,
    pre15_pushed_at  TIMESTAMPTZ,
    status           VARCHAR(16)  NOT NULL DEFAULT 'SCHEDULED',
    closed_at        TIMESTAMPTZ,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

ALTER TABLE workspace_meeting ADD COLUMN IF NOT EXISTS status VARCHAR(16) NOT NULL DEFAULT 'SCHEDULED';
ALTER TABLE workspace_meeting ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_workspace_meeting_room ON workspace_meeting (room_id);
CREATE INDEX IF NOT EXISTS idx_workspace_meeting_ws ON workspace_meeting (workspace_id, starts_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_meeting_starts ON workspace_meeting (starts_at);

CREATE TABLE IF NOT EXISTS workspace_meeting_participant
(
    meeting_id VARCHAR(32) NOT NULL,
    user_id    VARCHAR(32) NOT NULL,
    PRIMARY KEY (meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_meeting_participant_user
    ON workspace_meeting_participant (user_id);
