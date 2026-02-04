CREATE SCHEMA IF NOT EXISTS readmodel_eservice_template;

CREATE TABLE IF NOT EXISTS readmodel_eservice_template.eservice_template (
  id UUID,
  metadata_version INTEGER NOT NULL,
  creator_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  intended_target VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  technology VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  mode VARCHAR NOT NULL,
  is_signal_hub_enabled BOOLEAN,
  personal_data BOOLEAN,
  PRIMARY KEY (id),
  CONSTRAINT eservice_template_id_metadata_version_unique UNIQUE (id, metadata_version)
);

CREATE TABLE IF NOT EXISTS readmodel_eservice_template.eservice_template_version (
  id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  version INTEGER NOT NULL,
  description VARCHAR,
  state VARCHAR NOT NULL,
  voucher_lifespan INTEGER NOT NULL,
  daily_calls_per_consumer INTEGER,
  daily_calls_total INTEGER,
  agreement_approval_policy VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  deprecated_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id),
  FOREIGN KEY (eservice_template_id, metadata_version) REFERENCES readmodel_eservice_template.eservice_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_eservice_template.eservice_template_version_interface (
  id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  version_id UUID UNIQUE NOT NULL REFERENCES readmodel_eservice_template.eservice_template_version (id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  checksum VARCHAR NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (eservice_template_id, metadata_version) REFERENCES readmodel_eservice_template.eservice_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_eservice_template.eservice_template_version_document (
  id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  version_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template_version (id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  checksum VARCHAR NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (eservice_template_id, metadata_version) REFERENCES readmodel_eservice_template.eservice_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_eservice_template.eservice_template_version_attribute (
  attribute_id UUID NOT NULL,
  eservice_template_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  version_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template_version (id) ON DELETE CASCADE,
  explicit_attribute_verification BOOLEAN NOT NULL,
  kind VARCHAR NOT NULL,
  group_id INTEGER NOT NULL,
  daily_calls INTEGER,
  PRIMARY KEY (attribute_id, version_id, group_id),
  FOREIGN KEY (eservice_template_id, metadata_version) REFERENCES readmodel_eservice_template.eservice_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_eservice_template.eservice_template_risk_analysis (
  id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  risk_analysis_form_id UUID UNIQUE NOT NULL,
  risk_analysis_form_version VARCHAR NOT NULL,
  tenant_kind VARCHAR NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (eservice_template_id, metadata_version) REFERENCES readmodel_eservice_template.eservice_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_eservice_template.eservice_template_risk_analysis_answer (
  id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template_risk_analysis (risk_analysis_form_id) ON DELETE CASCADE,
  kind VARCHAR NOT NULL,
  key VARCHAR NOT NULL,
  value VARCHAR ARRAY NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (eservice_template_id, metadata_version) REFERENCES readmodel_eservice_template.eservice_template (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);
