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

CREATE TABLE domains.agreement (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  eservice_id VARCHAR(36) NOT NULL,
  descriptor_id VARCHAR(36) NOT NULL,
  producer_id VARCHAR(36) NOT NULL,
  consumer_id VARCHAR(36) NOT NULL,
  state VARCHAR NOT NULL,
  suspended_by_consumer BOOLEAN,
  suspended_by_producer BOOLEAN,
  suspended_by_platform BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  consumer_notes VARCHAR,
  rejection_reason VARCHAR,
  suspended_at TIMESTAMP WITH TIME ZONE,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE domains.agreement_stamp (
  agreement_id VARCHAR(36) NOT NULL REFERENCES domains.agreement(id),
  metadata_version INTEGER NOT NULL,
  who VARCHAR(36) NOT NULL,
  delegation_id VARCHAR(36),
  "when" TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (agreement_id, kind)
);

CREATE TABLE domains.agreement_attribute (
  agreement_id VARCHAR(36) NOT NULL REFERENCES domains.agreement(id),
  metadata_version INTEGER NOT NULL,
  attribute_id VARCHAR(36) NOT NULL,
  kind VARCHAR NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (agreement_id, attribute_id)
);

CREATE TABLE domains.agreement_consumer_document (
  id VARCHAR(36),
  agreement_id VARCHAR(36) NOT NULL REFERENCES domains.agreement(id),
  metadata_version INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE domains.agreement_contract (
  id VARCHAR(36),
  agreement_id VARCHAR(36) UNIQUE NOT NULL REFERENCES domains.agreement(id),
  metadata_version INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (agreement_id, id)
);

CREATE TABLE IF NOT EXISTS domains.purpose (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  eservice_id VARCHAR(36) NOT NULL,
  consumer_id VARCHAR(36) NOT NULL,
  delegation_id VARCHAR(36),
  suspended_by_consumer BOOLEAN,
  suspended_by_producer BOOLEAN,
  title VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP,
  is_free_of_charge BOOLEAN NOT NULL,
  free_of_charge_reason VARCHAR,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_risk_analysis_form (
  id VARCHAR(36),
  purpose_id VARCHAR(36) NOT NULL,
  metadata_version INTEGER NOT NULL,
  version VARCHAR NOT NULL,
  risk_analysis_id VARCHAR(36),
  deleted BOOLEAN,
  PRIMARY KEY (id, purpose_id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_risk_analysis_answer (
  id VARCHAR(36),
  purpose_id VARCHAR(36) NOT NULL REFERENCES domains.purpose(id),
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id VARCHAR(36),
  kind VARCHAR NOT NULL,
  key VARCHAR NOT NULL,
  value VARCHAR(65535),
  deleted BOOLEAN,
  PRIMARY KEY (id, purpose_id),
  FOREIGN KEY (risk_analysis_form_id, purpose_id) REFERENCES domains.purpose_risk_analysis_form (id, purpose_id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_version (
  id VARCHAR(36),
  purpose_id VARCHAR(36) NOT NULL REFERENCES domains.purpose(id),
  metadata_version INTEGER NOT NULL,
  state VARCHAR NOT NULL,
  daily_calls INTEGER NOT NULL,
  rejection_reason VARCHAR,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP,
  first_activation_at TIMESTAMP,
  suspended_at TIMESTAMP,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_version_document (
  id VARCHAR(36),
  purpose_id VARCHAR(36) NOT NULL REFERENCES domains.purpose(id),
  metadata_version INTEGER NOT NULL,
  purpose_version_id VARCHAR(36) NOT NULL REFERENCES domains.purpose_version(id),
  content_type VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  created_at TIMESTAMP NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id, purpose_version_id)
);

CREATE TABLE IF NOT EXISTS domains.delegation (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  delegator_id VARCHAR(36) NOT NULL,
  delegate_id VARCHAR(36) NOT NULL,
  eservice_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  rejection_reason VARCHAR,
  state VARCHAR NOT NULL,
  kind VARCHAR NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.delegation_stamp (
  delegation_id VARCHAR(36) NOT NULL REFERENCES domains.delegation (id),
  metadata_version INTEGER NOT NULL,
  who VARCHAR(36) NOT NULL,
  "when" TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (delegation_id, kind)
);

CREATE TABLE IF NOT EXISTS domains.delegation_contract_document (
  id VARCHAR(36),
  delegation_id VARCHAR(36) NOT NULL REFERENCES domains.delegation (id),
  metadata_version INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id),
  CONSTRAINT delegation_contract_document_delegation_id_kind_unique UNIQUE (delegation_id, kind)
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

CREATE TABLE IF NOT EXISTS domains.eservice_template (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  creator_id VARCHAR(36) NOT NULL,
  name VARCHAR NOT NULL,
  intended_target VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  technology VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  mode VARCHAR NOT NULL,
  is_signal_hub_enabled BOOLEAN,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.eservice_template_version (
  id VARCHAR(36),
  eservice_template_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template (id),
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
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.eservice_template_version_interface (
  id VARCHAR(36),
  eservice_template_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template (id),
  metadata_version INTEGER NOT NULL,
  version_id VARCHAR(36) UNIQUE NOT NULL REFERENCES domains.eservice_template_version (id),
  name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  checksum VARCHAR NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.eservice_template_version_document (
  id VARCHAR(36),
  eservice_template_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template (id),
  metadata_version INTEGER NOT NULL,
  version_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template_version (id),
  name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  checksum VARCHAR NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.eservice_template_version_attribute (
  attribute_id VARCHAR(36) NOT NULL,
  eservice_template_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template (id),
  metadata_version INTEGER NOT NULL,
  version_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template_version (id),
  explicit_attribute_verification BOOLEAN NOT NULL,
  kind VARCHAR NOT NULL,
  group_id INTEGER NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (attribute_id, version_id, group_id)
);

CREATE TABLE IF NOT EXISTS domains.eservice_template_risk_analysis (
  id VARCHAR(36),
  eservice_template_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template (id),
  metadata_version INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  risk_analysis_form_id VARCHAR(36) UNIQUE NOT NULL,
  risk_analysis_form_version VARCHAR NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.eservice_template_risk_analysis_answer (
  id VARCHAR(36),
  eservice_template_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template (id),
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template_risk_analysis (risk_analysis_form_id),
  kind VARCHAR NOT NULL,
  key VARCHAR NOT NULL,
  value VARCHAR(65535) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);