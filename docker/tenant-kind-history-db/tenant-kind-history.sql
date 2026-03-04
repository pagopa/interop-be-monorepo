CREATE TABLE IF NOT EXISTS tenant_kind_history.tenant_kind_history (
  tenant_id UUID NOT NULL,
  metadata_version INTEGER NOT NULL,
  kind VARCHAR NOT NULL,
  modified_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (tenant_id, metadata_version)
);