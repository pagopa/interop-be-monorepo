CREATE SCHEMA IF NOT EXISTS readmodel_notification_config;

CREATE TABLE IF NOT EXISTS readmodel_notification_config.tenant_notification_config (
  id UUID,
  metadata_version INTEGER NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  new_eservice_version_published BOOLEAN NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT tenant_notification_config_id_metadata_version_unique UNIQUE (id, metadata_version),
  CONSTRAINT tenant_notification_config_tenant_id_unique UNIQUE (tenant_id)
);

CREATE TABLE IF NOT EXISTS readmodel_notification_config.user_notification_config (
  id UUID,
  metadata_version INTEGER NOT NULL,
  user_id UUID NOT NULL,
  tenant_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  new_eservice_version_published_in_app BOOLEAN NOT NULL,
  new_eservice_version_published_email BOOLEAN NOT NULL,
  PRIMARY KEY (id),
  CONSTRAINT user_notification_config_id_metadata_version_unique UNIQUE (id, metadata_version),
  CONSTRAINT user_notification_config_user_id_tenant_id_unique UNIQUE (user_id, tenant_id)
);
