CREATE SCHEMA IF NOT EXISTS notification;

CREATE TABLE IF NOT EXISTS notification.notification (
  id UUID,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  body VARCHAR NOT NULL,
  deep_link VARCHAR NOT NULL,
  read_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id)
);