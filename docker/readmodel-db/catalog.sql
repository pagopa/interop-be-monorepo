CREATE SCHEMA IF NOT EXISTS readmodel_catalog;

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice (
  id UUID,
  metadata_version INTEGER NOT NULL,
  producer_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  technology VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  mode VARCHAR NOT NULL,
  is_signal_hub_enabled BOOLEAN,
  is_consumer_delegable BOOLEAN,
  is_client_access_delegable BOOLEAN,
  PRIMARY KEY (id)
);

-- TODO: update with new eservice-template model
CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_template_binding (
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice(id),
  metadata_version INTEGER NOT NULL,
  eservice_template_id UUID,
  instance_id VARCHAR,
  name VARCHAR,
  email VARCHAR,
  url VARCHAR,
  terms_and_conditions_url VARCHAR,
  server_url VARCHAR,
  PRIMARY KEY (eservice_id, eservice_template_id)
);

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_descriptor (
  id UUID,
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  version VARCHAR NOT NULL,
  description VARCHAR,
  state VARCHAR NOT NULL,
  audience VARCHAR ARRAY NOT NULL,
  voucher_lifespan INTEGER NOT NULL,
  daily_calls_per_consumer INTEGER NOT NULL,
  daily_calls_total INTEGER NOT NULL,
  agreement_approval_policy VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  server_urls VARCHAR ARRAY NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  deprecated_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_descriptor_rejection_reason (
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  descriptor_id UUID NOT NULL REFERENCES readmodel_catalog.eservice_descriptor (id) ON DELETE CASCADE,
  rejection_reason VARCHAR NOT NULL,
  rejected_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_descriptor_document(
  id UUID,
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  descriptor_id UUID NOT NULL REFERENCES readmodel_catalog.eservice_descriptor(id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  checksum VARCHAR NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  PRIMARY KEY(id)
);

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_descriptor_attribute(
  attribute_id UUID NOT NULL,
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  descriptor_id UUID NOT NULL REFERENCES readmodel_catalog.eservice_descriptor(id) ON DELETE CASCADE,
  explicit_attribute_verification BOOLEAN NOT NULL,
  kind VARCHAR NOT NULL,
  group_id INTEGER NOT NULL,
  PRIMARY KEY(attribute_id, descriptor_id, group_id)
);

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_risk_analysis(
  id UUID,
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  risk_analysis_form_id UUID UNIQUE NOT NULL,
  risk_analysis_form_version VARCHAR NOT NULL,
  PRIMARY KEY(id)
);

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_risk_analysis_answer(
  id UUID,
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id UUID NOT NULL REFERENCES readmodel_catalog.eservice_risk_analysis (risk_analysis_form_id) ON DELETE CASCADE,
  kind VARCHAR NOT NULL,
  key VARCHAR NOT NULL,
  value VARCHAR ARRAY NOT NULL,
  PRIMARY KEY(id)
);
