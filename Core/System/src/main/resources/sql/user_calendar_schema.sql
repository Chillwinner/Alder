CREATE TABLE IF NOT EXISTS user_calendar_event (
    id         VARCHAR(32) PRIMARY KEY,
    user_id    VARCHAR(64) NOT NULL,
    title      VARCHAR(200) NOT NULL,
    note       VARCHAR(2000),
    starts_at  TIMESTAMPTZ NOT NULL,
    ends_at    TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_calendar_event_user_start
    ON user_calendar_event (user_id, starts_at);
