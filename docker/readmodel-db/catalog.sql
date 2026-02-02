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
  template_id UUID,
  personal_data BOOLEAN,
  PRIMARY KEY (id),
  CONSTRAINT eservice_id_metadata_version_unique UNIQUE (id, metadata_version)
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
  PRIMARY KEY (id),
  FOREIGN KEY (eservice_id, metadata_version) REFERENCES readmodel_catalog.eservice (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_descriptor_template_version_ref (
  eservice_template_version_id UUID NOT NULL,
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  descriptor_id UUID NOT NULL REFERENCES readmodel_catalog.eservice_descriptor (id) ON DELETE CASCADE,
  contact_name VARCHAR,
  contact_email VARCHAR,
  contact_url VARCHAR,
  terms_and_conditions_url VARCHAR,
  PRIMARY KEY (eservice_template_version_id, descriptor_id),
  FOREIGN KEY (eservice_id, metadata_version) REFERENCES readmodel_catalog.eservice (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_descriptor_rejection_reason (
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  descriptor_id UUID NOT NULL REFERENCES readmodel_catalog.eservice_descriptor (id) ON DELETE CASCADE,
  rejection_reason VARCHAR NOT NULL,
  rejected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  FOREIGN KEY (eservice_id, metadata_version) REFERENCES readmodel_catalog.eservice (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_descriptor_interface (
  id UUID,
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  descriptor_id UUID UNIQUE NOT NULL REFERENCES readmodel_catalog.eservice_descriptor (id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  checksum VARCHAR NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (eservice_id, metadata_version) REFERENCES readmodel_catalog.eservice (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_descriptor_document (
  id UUID,
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  descriptor_id UUID NOT NULL REFERENCES readmodel_catalog.eservice_descriptor (id) ON DELETE CASCADE,
  name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  checksum VARCHAR NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (eservice_id, metadata_version) REFERENCES readmodel_catalog.eservice (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_descriptor_attribute (
  attribute_id UUID NOT NULL,
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  descriptor_id UUID NOT NULL REFERENCES readmodel_catalog.eservice_descriptor (id) ON DELETE CASCADE,
  kind VARCHAR NOT NULL,
  group_id INTEGER NOT NULL,
  PRIMARY KEY (attribute_id, descriptor_id, group_id),
  FOREIGN KEY (eservice_id, metadata_version) REFERENCES readmodel_catalog.eservice (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_risk_analysis (
  id UUID,
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  risk_analysis_form_id UUID NOT NULL,
  risk_analysis_form_version VARCHAR NOT NULL,
  PRIMARY KEY (id, eservice_id),
  UNIQUE (risk_analysis_form_id, eservice_id),
  FOREIGN KEY (eservice_id, metadata_version) REFERENCES readmodel_catalog.eservice (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_catalog.eservice_risk_analysis_answer (
  id UUID,
  eservice_id UUID NOT NULL REFERENCES readmodel_catalog.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id UUID NOT NULL,
  kind VARCHAR NOT NULL,
  key VARCHAR NOT NULL,
  value VARCHAR ARRAY NOT NULL,
  PRIMARY KEY (id, eservice_id),
  FOREIGN KEY (eservice_id, metadata_version) REFERENCES readmodel_catalog.eservice (id, metadata_version) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (risk_analysis_form_id, eservice_id) REFERENCES readmodel_catalog.eservice_risk_analysis (risk_analysis_form_id, eservice_id) ON DELETE CASCADE
);
