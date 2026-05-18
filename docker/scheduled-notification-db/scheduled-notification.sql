CREATE SCHEMA IF NOT EXISTS scheduled_notification;

CREATE TABLE IF NOT EXISTS scheduled_notification.scheduled_notification (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR NOT NULL,
    event_type VARCHAR NOT NULL,
    entity_id VARCHAR NOT NULL,
    send_at TIMESTAMP WITH TIME ZONE NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    CONSTRAINT scheduled_notification_uq
        UNIQUE (channel, event_type, entity_id, send_at)
);

CREATE INDEX IF NOT EXISTS scheduled_notification_due_idx
    ON scheduled_notification.scheduled_notification (channel, send_at)
    WHERE sent_at IS NULL;
