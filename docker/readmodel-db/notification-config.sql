CREATE SCHEMA IF NOT EXISTS readmodel_notification_config;

CREATE TABLE IF NOT EXISTS readmodel_notification_config.tenant_notification_config (
  id UUID,
  metadata_version INTEGER NOT NULL,
  tenant_id UUID NOT NULL,
  enabled BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id),
  CONSTRAINT tenant_notification_config_id_metadata_version_unique UNIQUE (id, metadata_version),
  CONSTRAINT tenant_notification_config_tenant_id_unique UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS readmodel_notification_config.user_notification_config (
  id UUID,
  metadata_version INTEGER NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  user_roles VARCHAR[] NOT NULL,
  in_app_notification_preference BOOLEAN NOT NULL,
  email_notification_preference BOOLEAN NOT NULL,
  email_digest_preference BOOLEAN NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id),
  CONSTRAINT user_notification_config_id_metadata_version_unique UNIQUE (id, metadata_version),
  CONSTRAINT user_notification_config_user_id_tenant_id_unique UNIQUE (user_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS readmodel_notification_config.user_enabled_in_app_notification (
  user_notification_config_id UUID NOT NULL REFERENCES readmodel_notification_config.user_notification_config (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  notification_type VARCHAR NOT NULL,
  PRIMARY KEY (user_notification_config_id, notification_type),
  FOREIGN KEY (user_notification_config_id, metadata_version) REFERENCES readmodel_notification_config.user_notification_config (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_notification_config.user_enabled_email_notification (
  user_notification_config_id UUID NOT NULL REFERENCES readmodel_notification_config.user_notification_config (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  notification_type VARCHAR NOT NULL,
  PRIMARY KEY (user_notification_config_id, notification_type),
  FOREIGN KEY (user_notification_config_id, metadata_version) REFERENCES readmodel_notification_config.user_notification_config (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);
