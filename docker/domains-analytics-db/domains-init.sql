CREATE SCHEMA IF NOT EXISTS domains;

CREATE TABLE IF NOT EXISTS domains.attribute (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  code VARCHAR,
  kind VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  origin VARCHAR,
  name VARCHAR NOT NULL,
  creation_time TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE domains.eservice (
  id VARCHAR(36),
  metadata_version INTEGER,
  producer_id VARCHAR(36),
  name VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  technology VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL,
  mode VARCHAR NOT NULL,
  is_signal_hub_enabled BOOLEAN,
  is_consumer_delegable BOOLEAN,
  is_client_access_delegable BOOLEAN,
  template_id VARCHAR(36),
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE domains.eservice_descriptor (
  id VARCHAR(36),
  eservice_id VARCHAR(36) NOT NULL REFERENCES domains.eservice (id),
  metadata_version INTEGER,
  version VARCHAR NOT NULL,
  description VARCHAR,
  state VARCHAR NOT NULL,
  audience VARCHAR(65535) NOT NULL,
  voucher_lifespan INTEGER NOT NULL,
  daily_calls_per_consumer INTEGER NOT NULL,
  daily_calls_total INTEGER NOT NULL,
  agreement_approval_policy VARCHAR,
  created_at TIMESTAMP NOT NULL,
  server_urls VARCHAR(65535) NOT NULL,
  published_at TIMESTAMP,
  suspended_at TIMESTAMP,
  deprecated_at TIMESTAMP,
  archived_at TIMESTAMP,
  deleted BOOLEAN,
  PRIMARY KEY (id),
  FOREIGN KEY (eservice_id) REFERENCES domains.eservice (id)
);

CREATE TABLE domains.eservice_descriptor_template_version_ref (
  eservice_template_version_id VARCHAR(36),
  eservice_id VARCHAR(36) NOT NULL REFERENCES domains.eservice (id),
  metadata_version INTEGER,
  descriptor_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_descriptor (id),
  contact_name VARCHAR,
  contact_email VARCHAR,
  contact_url VARCHAR,
  terms_and_conditions_url VARCHAR,
  deleted BOOLEAN,
  PRIMARY KEY (eservice_template_version_id, descriptor_id),
  FOREIGN KEY (eservice_id) REFERENCES domains.eservice (id)
);

CREATE TABLE domains.eservice_descriptor_rejection_reason (
  eservice_id VARCHAR(36) NOT NULL REFERENCES domains.eservice (id),
  metadata_version INTEGER,
  descriptor_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_descriptor (id),
  rejection_reason VARCHAR NOT NULL,
  rejected_at TIMESTAMP NOT NULL,
  deleted BOOLEAN,
  FOREIGN KEY (eservice_id) REFERENCES domains.eservice (id)
);

CREATE TABLE domains.eservice_descriptor_interface (
  id VARCHAR(36),
  eservice_id VARCHAR(36) NOT NULL REFERENCES domains.eservice (id),
  metadata_version INTEGER,
  descriptor_id VARCHAR(36) UNIQUE NOT NULL REFERENCES domains.eservice_descriptor (id),
  name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  checksum VARCHAR NOT NULL,
  upload_date TIMESTAMP NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id),
  FOREIGN KEY (eservice_id) REFERENCES domains.eservice (id)
);

CREATE TABLE domains.eservice_descriptor_document (
  id VARCHAR(36),
  eservice_id VARCHAR(36) NOT NULL REFERENCES domains.eservice (id),
  metadata_version INTEGER,
  descriptor_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_descriptor (id),
  name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  checksum VARCHAR NOT NULL,
  upload_date TIMESTAMP NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id),
  FOREIGN KEY (eservice_id) REFERENCES domains.eservice (id)
);

CREATE TABLE domains.eservice_descriptor_attribute (
  attribute_id VARCHAR(36) NOT NULL,
  eservice_id VARCHAR(36) NOT NULL REFERENCES domains.eservice (id),
  metadata_version INTEGER,
  descriptor_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_descriptor (id),
  explicit_attribute_verification BOOLEAN NOT NULL,
  kind VARCHAR NOT NULL,
  group_id INTEGER NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (attribute_id, descriptor_id, group_id),
  FOREIGN KEY (eservice_id) REFERENCES domains.eservice (id)
);

CREATE TABLE domains.eservice_risk_analysis (
  id VARCHAR(36),
  eservice_id VARCHAR(36) NOT NULL REFERENCES domains.eservice (id),
  metadata_version INTEGER,
  name VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL,
  risk_analysis_form_id VARCHAR(36) UNIQUE NOT NULL,
  risk_analysis_form_version VARCHAR NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id, eservice_id),
  UNIQUE (risk_analysis_form_id, eservice_id),
  FOREIGN KEY (eservice_id) REFERENCES domains.eservice (id)
);

CREATE TABLE domains.eservice_risk_analysis_answer (
  id VARCHAR(36),
  eservice_id VARCHAR(36) NOT NULL REFERENCES domains.eservice (id),
  metadata_version INTEGER,
  risk_analysis_form_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_risk_analysis (risk_analysis_form_id),
  kind VARCHAR NOT NULL,
  key VARCHAR NOT NULL,
  value VARCHAR(65535) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id, eservice_id),
  FOREIGN KEY (eservice_id) REFERENCES domains.eservice (id),
  FOREIGN KEY (risk_analysis_form_id, eservice_id) REFERENCES domains.eservice_risk_analysis (risk_analysis_form_id, eservice_id)
);

CREATE TABLE IF NOT EXISTS domains.tenant (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  kind VARCHAR,
  selfcare_id VARCHAR,
  external_id_origin VARCHAR NOT NULL,
  external_id_value VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  name VARCHAR NOT NULL,
  onboarded_at TIMESTAMP WITH TIME ZONE,
  sub_unit_type VARCHAR,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.tenant_mail (
  id VARCHAR,
  tenant_id VARCHAR(36) NOT NULL REFERENCES domains.tenant (id),
  metadata_version INTEGER NOT NULL,
  kind VARCHAR NOT NULL,
  address VARCHAR NOT NULL,
  description VARCHAR NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id, tenant_id, created_at)
);

CREATE TABLE IF NOT EXISTS domains.tenant_certified_attribute (
  attribute_id VARCHAR(36) NOT NULL,
  tenant_id VARCHAR(36) NOT NULL REFERENCES domains.tenant (id),
  metadata_version INTEGER NOT NULL,
  assignment_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  revocation_timestamp TIMESTAMP WITH TIME ZONE,
  deleted BOOLEAN,
  PRIMARY KEY (attribute_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS domains.tenant_declared_attribute (
  attribute_id VARCHAR(36),
  tenant_id VARCHAR(36) NOT NULL REFERENCES domains.tenant (id),
  metadata_version INTEGER NOT NULL,
  assignment_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  revocation_timestamp TIMESTAMP WITH TIME ZONE,
  delegation_id VARCHAR(36),
  deleted BOOLEAN,
  PRIMARY KEY (attribute_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS domains.tenant_verified_attribute (
  attribute_id VARCHAR(36),
  tenant_id VARCHAR(36) NOT NULL REFERENCES domains.tenant (id),
  metadata_version INTEGER NOT NULL,
  assignment_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (attribute_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS domains.tenant_verified_attribute_verifier (
  tenant_id VARCHAR(36) NOT NULL REFERENCES domains.tenant (id),
  metadata_version INTEGER NOT NULL,
  tenant_verifier_id VARCHAR(36) NOT NULL,
  tenant_verified_attribute_id VARCHAR(36) NOT NULL,
  verification_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_date TIMESTAMP WITH TIME ZONE,
  extension_date TIMESTAMP WITH TIME ZONE,
  delegation_id VARCHAR(36),
  deleted BOOLEAN,
  FOREIGN KEY (tenant_id, tenant_verified_attribute_id) REFERENCES domains.tenant_verified_attribute (tenant_id, attribute_id),
  FOREIGN KEY (tenant_verifier_id) REFERENCES domains.tenant (id)
);

CREATE TABLE IF NOT EXISTS domains.tenant_verified_attribute_revoker (
  tenant_id VARCHAR(36) NOT NULL REFERENCES domains.tenant (id),
  metadata_version INTEGER NOT NULL,
  tenant_revoker_id VARCHAR(36) NOT NULL,
  tenant_verified_attribute_id VARCHAR(36) NOT NULL,
  verification_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_date TIMESTAMP WITH TIME ZONE,
  extension_date TIMESTAMP WITH TIME ZONE,
  revocation_date TIMESTAMP WITH TIME ZONE NOT NULL,
  delegation_id VARCHAR(36),
  deleted BOOLEAN,
  FOREIGN KEY (tenant_id, tenant_verified_attribute_id) REFERENCES domains.tenant_verified_attribute (tenant_id, attribute_id),
  FOREIGN KEY (tenant_revoker_id) REFERENCES domains.tenant (id)
);

CREATE TABLE IF NOT EXISTS domains.tenant_feature (
  tenant_id VARCHAR(36) NOT NULL REFERENCES domains.tenant (id),
  metadata_version INTEGER NOT NULL,
  kind VARCHAR NOT NULL,
  certifier_id VARCHAR,
  availability_timestamp TIMESTAMP WITH TIME ZONE,
  deleted BOOLEAN,
  PRIMARY KEY (tenant_id, kind)
);