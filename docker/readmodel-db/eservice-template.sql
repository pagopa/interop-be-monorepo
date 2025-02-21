CREATE SCHEMA IF NOT EXISTS readmodel_eservice_template;

CREATE TABLE IF NOT EXISTS readmodel_eservice_template.eservice_template (
  id UUID,
  metadata_version INTEGER NOT NULL,
  creator_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  audience_description VARCHAR NOT NULL,
  eservice_description VARCHAR NOT NULL,
  technology VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  mode VARCHAR NOT NULL,
  is_signal_hub_enabled BOOLEAN,
  is_delegable BOOLEAN,
  is_client_access_delegable BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel_eservice_template.eservice_template_version (
  id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  version VARCHAR NOT NULL,
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
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel_eservice_template.eservice_template_version_document(
  id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  eservice_template_version_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template_version(id) ON DELETE CASCADE,
  name VARCHAR,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  checksum VARCHAR NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  PRIMARY KEY(id)
);

CREATE TABLE IF NOT EXISTS readmodel_eservice_template.eservice_template_version_attribute(
  attribute_id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  eservice_template_version_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template_version(id) ON DELETE CASCADE,
  explicit_attribute_verification BOOLEAN NOT NULL,
  kind VARCHAR NOT NULL,
  group_id INTEGER NOT NULL,
  PRIMARY KEY(attribute_id, eservice_template_version_id, group_id)
);

CREATE TABLE IF NOT EXISTS readmodel_eservice_template.eservice_template_risk_analysis(
  id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  name VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE,
  risk_analysis_form_id UUID UNIQUE,
  risk_analysis_form_version VARCHAR,
  PRIMARY KEY(id)
);

CREATE TABLE IF NOT EXISTS readmodel_eservice_template.eservice_template_risk_analysis_answer(
  id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id UUID NOT NULL REFERENCES readmodel_eservice_template.eservice_template_risk_analysis (risk_analysis_form_id) ON DELETE CASCADE,
  kind VARCHAR,
  key VARCHAR,
  value VARCHAR ARRAY,
  PRIMARY KEY(id)
);
