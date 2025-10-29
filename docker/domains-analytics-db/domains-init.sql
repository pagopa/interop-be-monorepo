CREATE SCHEMA IF NOT EXISTS domains;

CREATE TABLE IF NOT EXISTS domains.attribute (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  code VARCHAR(2048),
  kind VARCHAR(2048) NOT NULL,
  description VARCHAR(2048) NOT NULL,
  origin VARCHAR(2048),
  name VARCHAR(2048) NOT NULL,
  creation_time TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE domains.eservice (
  id VARCHAR(36),
  metadata_version INTEGER,
  producer_id VARCHAR(36),
  name VARCHAR(2048) NOT NULL,
  description VARCHAR(2048) NOT NULL,
  technology VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  mode VARCHAR(2048) NOT NULL,
  is_signal_hub_enabled BOOLEAN,
  is_consumer_delegable BOOLEAN,
  is_client_access_delegable BOOLEAN,
  template_id VARCHAR(36),
  personal_data BOOLEAN,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE domains.eservice_descriptor (
  id VARCHAR(36),
  eservice_id VARCHAR(36) NOT NULL REFERENCES domains.eservice (id),
  metadata_version INTEGER,
  version VARCHAR(2048) NOT NULL,
  description VARCHAR(2048),
  state VARCHAR(2048) NOT NULL,
  audience VARCHAR(65535) NOT NULL,
  voucher_lifespan INTEGER NOT NULL,
  daily_calls_per_consumer INTEGER NOT NULL,
  daily_calls_total INTEGER NOT NULL,
  agreement_approval_policy VARCHAR(2048),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  server_urls VARCHAR(65535) NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  deprecated_at TIMESTAMP WITH TIME ZONE,
  archived_at TIMESTAMP WITH TIME ZONE,
  deleted BOOLEAN,
  PRIMARY KEY (id),
  FOREIGN KEY (eservice_id) REFERENCES domains.eservice (id)
);

CREATE TABLE domains.eservice_descriptor_template_version_ref (
  eservice_template_version_id VARCHAR(36),
  eservice_id VARCHAR(36) NOT NULL REFERENCES domains.eservice (id),
  metadata_version INTEGER,
  descriptor_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_descriptor (id),
  contact_name VARCHAR(2048),
  contact_email VARCHAR(2048),
  contact_url VARCHAR(2048),
  terms_and_conditions_url VARCHAR(2048),
  deleted BOOLEAN,
  PRIMARY KEY (eservice_template_version_id, descriptor_id),
  FOREIGN KEY (eservice_id) REFERENCES domains.eservice (id)
);

CREATE TABLE domains.eservice_descriptor_rejection_reason (
  eservice_id VARCHAR(36) NOT NULL REFERENCES domains.eservice (id),
  metadata_version INTEGER,
  descriptor_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_descriptor (id),
  rejection_reason VARCHAR(2048) NOT NULL,
  rejected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  FOREIGN KEY (eservice_id) REFERENCES domains.eservice (id)
);

CREATE TABLE domains.eservice_descriptor_interface (
  id VARCHAR(36),
  eservice_id VARCHAR(36) NOT NULL REFERENCES domains.eservice (id),
  metadata_version INTEGER,
  descriptor_id VARCHAR(36) UNIQUE NOT NULL REFERENCES domains.eservice_descriptor (id),
  name VARCHAR(2048) NOT NULL,
  content_type VARCHAR(2048) NOT NULL,
  pretty_name VARCHAR(2048) NOT NULL,
  path VARCHAR(2048) NOT NULL,
  checksum VARCHAR(2048) NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id),
  FOREIGN KEY (eservice_id) REFERENCES domains.eservice (id)
);

CREATE TABLE domains.eservice_descriptor_document (
  id VARCHAR(36),
  eservice_id VARCHAR(36) NOT NULL REFERENCES domains.eservice (id),
  metadata_version INTEGER,
  descriptor_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_descriptor (id),
  name VARCHAR(2048) NOT NULL,
  content_type VARCHAR(2048) NOT NULL,
  pretty_name VARCHAR(2048) NOT NULL,
  path VARCHAR(2048) NOT NULL,
  checksum VARCHAR(2048) NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
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
  kind VARCHAR(2048) NOT NULL,
  group_id INTEGER NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (attribute_id, descriptor_id, group_id),
  FOREIGN KEY (eservice_id) REFERENCES domains.eservice (id)
);

CREATE TABLE domains.eservice_risk_analysis (
  id VARCHAR(36),
  eservice_id VARCHAR(36) NOT NULL,
  metadata_version INTEGER,
  name VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  risk_analysis_form_id VARCHAR(36) UNIQUE NOT NULL,
  risk_analysis_form_version VARCHAR(2048) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id, eservice_id),
  UNIQUE (risk_analysis_form_id, eservice_id)
);

CREATE TABLE domains.eservice_risk_analysis_answer (
  id VARCHAR(36),
  eservice_id VARCHAR(36) NOT NULL,
  metadata_version INTEGER,
  risk_analysis_form_id VARCHAR(36) NOT NULL,
  kind VARCHAR(2048) NOT NULL,
  key VARCHAR(2048) NOT NULL,
  value VARCHAR(65535) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id, eservice_id)
);

CREATE TABLE domains.agreement (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  eservice_id VARCHAR(36) NOT NULL,
  descriptor_id VARCHAR(36) NOT NULL,
  producer_id VARCHAR(36) NOT NULL,
  consumer_id VARCHAR(36) NOT NULL,
  state VARCHAR(2048) NOT NULL,
  suspended_by_consumer BOOLEAN,
  suspended_by_producer BOOLEAN,
  suspended_by_platform BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  consumer_notes VARCHAR(2048),
  rejection_reason VARCHAR(2048),
  suspended_at TIMESTAMP WITH TIME ZONE,
  signed_contract VARCHAR(36),
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE domains.agreement_stamp (
  agreement_id VARCHAR(36) NOT NULL REFERENCES domains.agreement(id),
  metadata_version INTEGER NOT NULL,
  who VARCHAR(36) NOT NULL,
  delegation_id VARCHAR(36),
  "when" TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR(2048) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (agreement_id, kind)
);

CREATE TABLE domains.agreement_attribute (
  agreement_id VARCHAR(36) NOT NULL REFERENCES domains.agreement(id),
  metadata_version INTEGER NOT NULL,
  attribute_id VARCHAR(36) NOT NULL,
  kind VARCHAR(2048) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (agreement_id, attribute_id)
);

CREATE TABLE domains.agreement_consumer_document (
  id VARCHAR(36),
  agreement_id VARCHAR(36) NOT NULL REFERENCES domains.agreement(id),
  metadata_version INTEGER NOT NULL,
  name VARCHAR(2048) NOT NULL,
  pretty_name VARCHAR(2048) NOT NULL,
  content_type VARCHAR(2048) NOT NULL,
  path VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE domains.agreement_contract (
  id VARCHAR(36),
  agreement_id VARCHAR(36) UNIQUE NOT NULL REFERENCES domains.agreement(id),
  metadata_version INTEGER NOT NULL,
  name VARCHAR(2048) NOT NULL,
  pretty_name VARCHAR(2048) NOT NULL,
  content_type VARCHAR(2048) NOT NULL,
  path VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE NOT NULL,
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
  title VARCHAR(2048) NOT NULL,
  description VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  is_free_of_charge BOOLEAN NOT NULL,
  free_of_charge_reason VARCHAR(2048),
  purpose_template_id VARCHAR(36),
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_risk_analysis_form (
  id VARCHAR(36),
  purpose_id VARCHAR(36) NOT NULL,
  metadata_version INTEGER NOT NULL,
  version VARCHAR(2048) NOT NULL,
  risk_analysis_id VARCHAR(36),
  deleted BOOLEAN,
  PRIMARY KEY (id, purpose_id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_risk_analysis_answer (
  id VARCHAR(36),
  purpose_id VARCHAR(36) NOT NULL REFERENCES domains.purpose(id),
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id VARCHAR(36),
  kind VARCHAR(2048) NOT NULL,
  key VARCHAR(2048) NOT NULL,
  value VARCHAR(65535),
  deleted BOOLEAN,
  PRIMARY KEY (id, purpose_id),
  FOREIGN KEY (risk_analysis_form_id, purpose_id) REFERENCES domains.purpose_risk_analysis_form (id, purpose_id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_version (
  id VARCHAR(36),
  purpose_id VARCHAR(36) NOT NULL REFERENCES domains.purpose(id),
  metadata_version INTEGER NOT NULL,
  state VARCHAR(2048) NOT NULL,
  daily_calls INTEGER NOT NULL,
  rejection_reason VARCHAR(2048),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  first_activation_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_version_document (
  id VARCHAR(36),
  purpose_id VARCHAR(36) NOT NULL REFERENCES domains.purpose(id),
  metadata_version INTEGER NOT NULL,
  purpose_version_id VARCHAR(36) NOT NULL REFERENCES domains.purpose_version(id),
  content_type VARCHAR(2048) NOT NULL,
  path VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
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
  rejection_reason VARCHAR(2048),
  state VARCHAR(2048) NOT NULL,
  kind VARCHAR(2048) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.delegation_stamp (
  delegation_id VARCHAR(36) NOT NULL REFERENCES domains.delegation (id),
  metadata_version INTEGER NOT NULL,
  who VARCHAR(36) NOT NULL,
  "when" TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR(2048) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (delegation_id, kind)
);

CREATE TABLE IF NOT EXISTS domains.purpose_version_stamp (
  purpose_id VARCHAR(36) NOT NULL REFERENCES domains.purpose(id),
  purpose_version_id VARCHAR(36) NOT NULL REFERENCES domains.purpose_version(id),
  metadata_version INTEGER NOT NULL,
  who VARCHAR(36) NOT NULL,
  "when" TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR(2048) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (purpose_version_id, kind)
);

CREATE TABLE IF NOT EXISTS domains.delegation_contract_document (
  id VARCHAR(36),
  delegation_id VARCHAR(36) NOT NULL REFERENCES domains.delegation (id),
  metadata_version INTEGER NOT NULL,
  name VARCHAR(2048) NOT NULL,
  content_type VARCHAR(2048) NOT NULL,
  pretty_name VARCHAR(2048) NOT NULL,
  path VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR(2048) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id),
  CONSTRAINT delegation_contract_document_delegation_id_kind_unique UNIQUE (delegation_id, kind)
);

CREATE TABLE IF NOT EXISTS domains.tenant (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  kind VARCHAR(2048),
  selfcare_id VARCHAR(2048),
  external_id_origin VARCHAR(2048) NOT NULL,
  external_id_value VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  name VARCHAR(2048) NOT NULL,
  onboarded_at TIMESTAMP WITH TIME ZONE,
  sub_unit_type VARCHAR(2048),
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.tenant_mail (
  id VARCHAR(2048),
  tenant_id VARCHAR(36) NOT NULL REFERENCES domains.tenant (id),
  metadata_version INTEGER NOT NULL,
  kind VARCHAR(2048) NOT NULL,
  address VARCHAR(2048) NOT NULL,
  description VARCHAR(2048) NULL,
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
  kind VARCHAR(2048) NOT NULL,
  certifier_id VARCHAR(2048),
  availability_timestamp TIMESTAMP WITH TIME ZONE,
  deleted BOOLEAN,
  PRIMARY KEY (tenant_id, kind)
);

CREATE TABLE IF NOT EXISTS domains.client (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  consumer_id VARCHAR(36) NOT NULL,
  admin_id VARCHAR(36),
  name VARCHAR(2048) NOT NULL,
  description VARCHAR(2048),
  kind VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.client_user (
  metadata_version INTEGER NOT NULL,
  client_id VARCHAR(36) NOT NULL REFERENCES domains.client (id),
  user_id VARCHAR(36) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (client_id, user_id)
);

CREATE TABLE IF NOT EXISTS domains.client_purpose (
  metadata_version INTEGER NOT NULL,
  client_id VARCHAR(36) NOT NULL REFERENCES domains.client (id),
  purpose_id VARCHAR(36) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (client_id, purpose_id)
);

CREATE TABLE IF NOT EXISTS domains.client_key (
  metadata_version INTEGER NOT NULL,
  client_id VARCHAR(36) NOT NULL REFERENCES domains.client (id),
  user_id VARCHAR(36),
  kid VARCHAR(2048) NOT NULL,
  name VARCHAR(2048) NOT NULL,
  encoded_pem VARCHAR(8192) NOT NULL,
  "algorithm" VARCHAR(2048) NOT NULL,
  "use" VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted_at TIMESTAMP WITH TIME ZONE,
  deleted BOOLEAN,
  PRIMARY KEY (client_id, kid)
);

CREATE TABLE IF NOT EXISTS domains.producer_keychain (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  producer_id VARCHAR(36) NOT NULL,
  name VARCHAR(2048) NOT NULL,
  description VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.producer_keychain_user (
  metadata_version INTEGER NOT NULL,
  producer_keychain_id VARCHAR(36) NOT NULL REFERENCES domains.producer_keychain (id),
  user_id VARCHAR(36) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (producer_keychain_id, user_id)
);

CREATE TABLE IF NOT EXISTS domains.producer_keychain_eservice (
  metadata_version INTEGER NOT NULL,
  producer_keychain_id VARCHAR(36) NOT NULL REFERENCES domains.producer_keychain (id),
  eservice_id VARCHAR(36) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (producer_keychain_id, eservice_id)
);

CREATE TABLE IF NOT EXISTS domains.producer_keychain_key (
  metadata_version INTEGER NOT NULL,
  producer_keychain_id VARCHAR(36) NOT NULL REFERENCES domains.producer_keychain (id),
  user_id VARCHAR(36) NOT NULL,
  kid VARCHAR(2048) NOT NULL,
  name VARCHAR(2048) NOT NULL,
  encoded_pem VARCHAR(8192) NOT NULL,
  "algorithm" VARCHAR(2048) NOT NULL,
  "use" VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (producer_keychain_id, kid)
);

CREATE TABLE IF NOT EXISTS domains.eservice_template (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  creator_id VARCHAR(36) NOT NULL,
  name VARCHAR(2048) NOT NULL,
  intended_target VARCHAR(2048) NOT NULL,
  description VARCHAR(2048) NOT NULL,
  technology VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  mode VARCHAR(2048) NOT NULL,
  is_signal_hub_enabled BOOLEAN,
  personal_data BOOLEAN,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.eservice_template_version (
  id VARCHAR(36),
  eservice_template_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template (id),
  metadata_version INTEGER NOT NULL,
  version INTEGER NOT NULL,
  description VARCHAR(2048),
  state VARCHAR(2048) NOT NULL,
  voucher_lifespan INTEGER NOT NULL,
  daily_calls_per_consumer INTEGER,
  daily_calls_total INTEGER,
  agreement_approval_policy VARCHAR(2048),
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
  name VARCHAR(2048) NOT NULL,
  content_type VARCHAR(2048) NOT NULL,
  pretty_name VARCHAR(2048) NOT NULL,
  path VARCHAR(2048) NOT NULL,
  checksum VARCHAR(2048) NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.eservice_template_version_document (
  id VARCHAR(36),
  eservice_template_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template (id),
  metadata_version INTEGER NOT NULL,
  version_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template_version (id),
  name VARCHAR(2048) NOT NULL,
  content_type VARCHAR(2048) NOT NULL,
  pretty_name VARCHAR(2048) NOT NULL,
  path VARCHAR(2048) NOT NULL,
  checksum VARCHAR(2048) NOT NULL,
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
  kind VARCHAR(2048) NOT NULL,
  group_id INTEGER NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (attribute_id, version_id, group_id)
);

CREATE TABLE IF NOT EXISTS domains.eservice_template_risk_analysis (
  id VARCHAR(36),
  eservice_template_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template (id),
  metadata_version INTEGER NOT NULL,
  name VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  risk_analysis_form_id VARCHAR(36) UNIQUE NOT NULL,
  risk_analysis_form_version VARCHAR(2048) NOT NULL,
  tenant_kind VARCHAR(2048) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.eservice_template_risk_analysis_answer (
  id VARCHAR(36),
  eservice_template_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template (id),
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id VARCHAR(36) NOT NULL REFERENCES domains.eservice_template_risk_analysis (risk_analysis_form_id),
  kind VARCHAR(2048) NOT NULL,
  key VARCHAR(2048) NOT NULL,
  value VARCHAR(65535) NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_template (
  id VARCHAR(36),
  metadata_version INTEGER NOT NULL,
  target_description VARCHAR(2048) NOT NULL,
  target_tenant_kind VARCHAR(2048) NOT NULL,
  creator_id VARCHAR(36) NOT NULL,
  state VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  purpose_title VARCHAR(2048) NOT NULL,
  purpose_description VARCHAR(2048) NOT NULL,
  purpose_is_free_of_charge BOOLEAN NOT NULL,
  purpose_free_of_charge_reason VARCHAR(2048),
  purpose_daily_calls INTEGER,
  handles_personal_data BOOLEAN NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_template_eservice_descriptor (
  metadata_version INTEGER NOT NULL,
  purpose_template_id VARCHAR(36) NOT NULL REFERENCES domains.purpose_template (id),
  eservice_id VARCHAR(36),
  descriptor_id VARCHAR(36),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  PRIMARY KEY (purpose_template_id, eservice_id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_template_risk_analysis_form (
  id VARCHAR(36),
  purpose_template_id VARCHAR(36) NOT NULL REFERENCES domains.purpose_template (id),
  metadata_version INTEGER NOT NULL,
  version VARCHAR(2048) NOT NULL,
  deleted BOOLEAN,
  UNIQUE (purpose_template_id),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_template_risk_analysis_answer (
  id VARCHAR(36),
  purpose_template_id VARCHAR(36) NOT NULL REFERENCES domains.purpose_template (id),
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id VARCHAR(36) NOT NULL REFERENCES domains.purpose_template_risk_analysis_form (id),
  kind VARCHAR(2048) NOT NULL,
  key VARCHAR(2048) NOT NULL,
  value VARCHAR(65535) NOT NULL,
  editable BOOLEAN NOT NULL,
  suggested_values VARCHAR(65535),
  deleted BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_template_risk_analysis_answer_annotation (
  id VARCHAR(36),
  purpose_template_id VARCHAR(36) NOT NULL REFERENCES domains.purpose_template (id),
  metadata_version INTEGER NOT NULL,
  answer_id VARCHAR(36) NOT NULL REFERENCES domains.purpose_template_risk_analysis_answer (id),
  "text" VARCHAR(2048) NOT NULL,
  deleted BOOLEAN,
  UNIQUE (answer_id),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS domains.purpose_template_risk_analysis_answer_annotation_document (
  id VARCHAR(36),
  purpose_template_id VARCHAR(36) NOT NULL REFERENCES domains.purpose_template (id),
  metadata_version INTEGER NOT NULL,
  annotation_id VARCHAR(36) NOT NULL REFERENCES domains.purpose_template_risk_analysis_answer_annotation (id),
  name VARCHAR(2048) NOT NULL,
  pretty_name VARCHAR(2048) NOT NULL,
  content_type VARCHAR(2048) NOT NULL,
  path VARCHAR(2048) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  deleted BOOLEAN,
  checksum VARCHAR NOT NULL,
  PRIMARY KEY (id)
);
