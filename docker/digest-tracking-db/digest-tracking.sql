CREATE SCHEMA IF NOT EXISTS digest_tracking;

CREATE TABLE IF NOT EXISTS digest_tracking.digest_email_sent (
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    latest_sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (user_id, tenant_id)
);