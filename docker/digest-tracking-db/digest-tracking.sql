CREATE SCHEMA IF NOT EXISTS digest_tracking;

CREATE TABLE IF NOT EXISTS digest_tracking.digest_email_sent (
    user_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    sent_at TIMESTAMP WITH TIME ZONE NOT NULL,
    PRIMARY KEY (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_digest_email_sent_sent_at 
ON digest_tracking.digest_email_sent (sent_at);
