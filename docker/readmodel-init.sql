CREATE SCHEMA readmodel;

-- ATTRIBUTE
CREATE TABLE readmodel.attribute(
  id UUID,
  version INTEGER NOT NULL,
  code VARCHAR NOT NULL,
  kind VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  origin VARCHAR,
  name VARCHAR NOT NULL,
  creation_time TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id)
);

-- TENANT
CREATE TABLE IF NOT EXISTS readmodel.tenant (
  id UUID,
  version INTEGER,
  kind VARCHAR,
  selfcare_id VARCHAR,
  external_id_origin VARCHAR NOT NULL,
  external_id_value VARCHAR NOT NULL,
  -- features
  -- attributes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  -- mails
  name VARCHAR NOT NULL,
  onboarded_at TIMESTAMP WITH TIME ZONE,
  sub_unit_type VARCHAR,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_mail (
  id VARCHAR,
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id) ON DELETE CASCADE,
  tenant_version INTEGER NOT NULL,
  kind VARCHAR NOT NULL,
  address VARCHAR NULL,
  description VARCHAR NULL,
  created_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_certified_attribute (
  id UUID REFERENCES readmodel.attribute(id),
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id) ON DELETE CASCADE,
  tenant_version INTEGER NOT NULL,
  assignment_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  revocation_timestamp TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id, tenant_id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_declared_attribute (
  id UUID REFERENCES readmodel.attribute(id),
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id),
  tenant_version INTEGER,
  assignment_timestamp TIMESTAMP NOT NULL,
  revocation_timestamp TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id, tenant_id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_verified_attribute (
  id UUID REFERENCES readmodel.attribute(id),
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id) ON DELETE CASCADE,
  tenant_version INTEGER,
  assignment_timestamp TIMESTAMP NOT NULL,
  PRIMARY KEY (id, tenant_id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_verified_attribute_verifier (
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id),
  tenant_version INTEGER,
  id UUID REFERENCES readmodel.tenant (id),
  -- verifier id
  tenant_verified_attribute_id UUID NOT NULL REFERENCES readmodel.attribute(id),
  verification_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_date TIMESTAMP WITH TIME ZONE,
  extension_date TIMESTAMP WITH TIME ZONE,
  delegation_id UUID,
  PRIMARY KEY (id, tenant_verified_attribute_id, tenant_id),
  FOREIGN KEY (tenant_id, tenant_verified_attribute_id) REFERENCES readmodel.tenant_verified_attribute (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_verified_attribute_revoker (
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id),
  tenant_version INTEGER,
  id UUID REFERENCES readmodel.tenant (id),
  -- revoker id
  tenant_verified_attribute_id UUID NOT NULL REFERENCES readmodel.tenant_verified_attribute (id) ON DELETE CASCADE,
  verification_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_date TIMESTAMP WITH TIME ZONE,
  extension_date TIMESTAMP WITH TIME ZONE,
  revocation_date TIMESTAMP NOT NULL,
  delegation_id UUID,
  PRIMARY KEY (id, tenant_verified_attribute_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_feature_certifier(
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id) ON DELETE CASCADE,
  tenant_version INTEGER,
  certifier_id VARCHAR,
  PRIMARY KEY (certifier_id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_feature_delegated_producer(
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id) ON DELETE CASCADE,
  tenant_version INTEGER,
  availability_timestamp TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (tenant_id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_feature_delegated_consumer(
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id) ON DELETE CASCADE,
  tenant_version INTEGER,
  availability_timestamp TIMESTAMP WITH TIME ZONE
);

-- TEMPLATE
CREATE TABLE IF NOT EXISTS readmodel.eservice_template (
  id UUID,
  version INTEGER NOT NULL,
  creator_id UUID NOT NULL REFERENCES readmodel.tenant(id),
  name VARCHAR NOT NULL,
  audience_description VARCHAR NOT NULL,
  eservice_description VARCHAR NOT NULL,
  technology VARCHAR NOT NULL,
  -- versions
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  -- riskAnalysis
  mode VARCHAR NOT NULL,
  is_signal_hub_enabled BOOLEAN,
  is_delegable BOOLEAN,
  is_client_access_delegable BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_template_version (
  id UUID,
  eservice_template_id UUID NOT NULL references readmodel.eservice_template (id) ON DELETE CASCADE,
  eservice_template_version INTEGER NOT NULL,
  version VARCHAR NOT NULL,
  description VARCHAR,
  -- interface
  -- docs
  state VARCHAR NOT NULL,
  voucher_lifespan INTEGER NOT NULL,
  daily_calls_per_consumer INTEGER,
  daily_calls_total INTEGER,
  agreement_approval_policy VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  server_urls VARCHAR ARRAY NOT NULL,
  published_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  deprecated_at TIMESTAMP WITH TIME ZONE,
  -- attributes
  PRIMARY KEY (id)
);

CREATE TABLE readmodel.eservice_template_version_document(
  id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel.eservice_template (id) ON DELETE CASCADE,
  eservice_template_version INTEGER NOT NULL,
  template_version_id UUID NOT NULL REFERENCES readmodel.eservice_template_version(id) ON DELETE CASCADE,
  name VARCHAR,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  checksum VARCHAR NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  -- INTERFACE/DOCUMENT
  PRIMARY KEY(id)
);

/*
 certified: [[a], [b,c], [d]]
 attr, kind, group_id, sorting_id
 a | certified | 1 | 0
 b | certified | 2 | 0
 c | certified | 2 | 1
 d | certified | 3 | 0
 */
CREATE TABLE readmodel.eservice_template_version_attribute(
  id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel.eservice_template (id) ON DELETE CASCADE,
  eservice_template_version INTEGER NOT NULL,
  eservice_template_version_id UUID NOT NULL REFERENCES readmodel.eservice_template_version(id) ON DELETE CASCADE,
  explicit_attribute_verification BOOLEAN NOT NULL,
  kind VARCHAR NOT NULL,
  -- CERTIFIED/DECLARED/VERIFIED
  group_id INTEGER NOT NULL,
  -- id of the group
  sorting_id INTEGER NOT NULL,
  -- index of the attribute inside its group
  PRIMARY KEY(id, eservice_template_version_id) -- TODO verify if the same attribute can be assigned twice in the same eservice_template_version
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_template_risk_analysis(
  id UUID,
  eservice_template_id UUID REFERENCES readmodel.eservice_template (id) ON DELETE CASCADE,
  eservice_template_version INTEGER,
  name VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE,
  risk_analysis_form_id UUID,
  risk_analysis_form_version VARCHAR,
  PRIMARY KEY(id)
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_template_risk_analysis_answer(
  id UUID,
  eservice_template_id UUID REFERENCES readmodel.eservice_template (id) ON DELETE CASCADE,
  eservice_template_version INTEGER,
  risk_analysis_form_id UUID,
  -- REFERENCES readmodel.eservice_risk_analysis (risk_analysis_form_id) -- risk_analysis_form_id IS NOT PK
  kind VARCHAR,
  -- SINGLE/MULTI
  key VARCHAR,
  value VARCHAR ARRAY,
  PRIMARY KEY(id)
);

-- CATALOG
CREATE TABLE IF NOT EXISTS readmodel.eservice (
  id UUID,
  version INTEGER NOT NULL,
  producer_id UUID NOT NULL REFERENCES readmodel.tenant(id),
  name VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  technology VARCHAR NOT NULL,
  -- attributes (moved to descriptors)
  -- descriptors
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  -- riskAnalysis
  mode VARCHAR NOT NULL,
  is_signal_hub_enabled BOOLEAN,
  is_delegable BOOLEAN,
  is_client_access_delegable BOOLEAN,
  eservice_template_id UUID REFERENCES readmodel.eservice_template(id),
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_template_binding (
  eservice_id UUID REFERENCES readmodel.eservice(id),
  eservice_version INTEGER,
  eservice_template_id UUID REFERENCES readmodel.eservice_template(id),
  instance_id VARCHAR,
  name VARCHAR,
  email VARCHAR,
  url VARCHAR,
  terms_and_conditions_url VARCHAR,
  server_url VARCHAR,
);

CREATE TABLE IF NOT EXISTS readmodel.descriptor (
  id UUID,
  eservice_id UUID NOT NULL references readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version INTEGER NOT NULL,
  version VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  -- interface
  -- docs
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
  -- attributes
  -- reection_reasons
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.rejection_reason (
  id UUID,
  eservice_id UUID NOT NULL REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version INTEGER,
  descriptor_id UUID NOT NULL REFERENCES readmodel.descriptor (id) ON DELETE CASCADE,
  rejection_reason VARCHAR NOT NULL,
  rejected_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE readmodel.descriptor_document(
  id UUID,
  eservice_id UUID NOT NULL REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version INTEGER NOT NULL,
  descriptor_id UUID NOT NULL REFERENCES readmodel.descriptor(id) ON DELETE CASCADE,
  name VARCHAR,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  checksum VARCHAR NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  -- INTERFACE/DOCUMENT
  PRIMARY KEY(id)
);

/*
 certified: [[a], [b,c], [d]]
 attr, kind, group_id, sorting_id
 a | certified | 1 | 0
 b | certified | 2 | 0
 c | certified | 2 | 1
 d | certified | 3 | 0
 */
CREATE TABLE readmodel.descriptor_attribute(
  id UUID,
  eservice_id UUID NOT NULL REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version INTEGER NOT NULL,
  descriptor_id UUID NOT NULL REFERENCES readmodel.descriptor(id) ON DELETE CASCADE,
  explicit_attribute_verification BOOLEAN NOT NULL,
  kind VARCHAR NOT NULL,
  -- CERTIFIED/DECLARED/VERIFIED
  group_id INTEGER NOT NULL,
  -- id of the group
  sorting_id INTEGER NOT NULL,
  -- index of the attribute inside its group
  PRIMARY KEY(id, descriptor_id) -- TODO verify if the same attribute can be assigned twice in the same descriptor
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_risk_analysis(
  id UUID,
  eservice_id UUID REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version INTEGER,
  name VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE,
  risk_analysis_form_id UUID UNIQUE,
  risk_analysis_form_version VARCHAR,
  PRIMARY KEY(id)
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_risk_analysis_answer(
  id UUID,
  eservice_id UUID REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version INTEGER,
  risk_analysis_form_id UUID REFERENCES readmodel.eservice_risk_analysis (risk_analysis_form_id),
  -- risk_analysis_form_id IS NOT PK
  kind VARCHAR,
  -- SINGLE/MULTI
  key VARCHAR,
  value VARCHAR ARRAY,
  PRIMARY KEY(id)
);

-- AGREEMENT
CREATE TABLE readmodel.agreement(
  id uuid,
  version integer NOT NULL,
  eservice_id uuid NOT NULL REFERENCES readmodel.eservice(id),
  descriptor_id uuid NOT NULL REFERENCES readmodel.descriptor(id),
  producer_id UUID NOT NULL REFERENCES readmodel.tenant (id),
  consumer_id UUID NOT NULL REFERENCES readmodel.tenant (id),
  state varchar NOT NULL,
  -- verifiedAttributes
  -- certifiedAttributes
  -- declaredAttributes
  suspended_by_consumer boolean,
  suspended_by_producer boolean,
  suspended_by_platform boolean,
  -- consumerDocuments
  created_at timestamp with time zone NOT NULL,
  updated_at timestamp with time zone,
  consumer_notes varchar,
  -- contract
  -- stamps
  submission_who uuid,
  submission_when timestamp with time zone,
  submission_delegation_id uuid,
  activation_who uuid,
  activation_when timestamp with time zone,
  activation_delegation_id uuid,
  rejection_who uuid,
  rejection_when timestamp with time zone,
  rejection_delegation_id uuid,
  suspension_by_producer_who uuid,
  suspension_by_producer_when timestamp with time zone,
  suspension_by_producer_delegation_id uuid,
  suspension_by_consumer_who uuid,
  suspension_by_consumer_when timestamp with time zone,
  suspension_by_consumer_delegation_id uuid,
  upgrade_who uuid,
  upgrade_when timestamp with time zone,
  upgrade_delegation_id uuid,
  archiving_who uuid,
  archiving_when timestamp with time zone,
  archiving_delegation_id uuid,
  rejection_reason varchar,
  suspended_at timestamp with time zone,
  PRIMARY KEY (id)
);

CREATE TABLE readmodel.agreement_attribute(
  agreement_id uuid REFERENCES readmodel.agreement(id) ON DELETE CASCADE,
  agreement_version integer NOT NULL,
  attribute_id uuid,
  kind varchar NOT NULL,
  PRIMARY KEY (agreement_id, attribute_id)
);

CREATE TABLE readmodel.agreement_consumer_document(
  id uuid,
  agreement_id uuid REFERENCES readmodel.agreement(id) ON DELETE CASCADE,
  agreement_version integer NOT NULL,
  name varchar NOT NULL,
  pretty_name varchar NOT NULL,
  content_type varchar NOT NULL,
  path varchar NOT NULL,
  created_at timestamp with time zone NOT NULL,
  kind varchar NOT NULL -- consumerDoc / contract
);

-- DELEGATION
CREATE TABLE IF NOT EXISTS readmodel.delegation(
  id UUID,
  version INTEGER,
  delegator_id UUID REFERENCES readmodel.tenant(id),
  delegate_id UUID REFERENCES readmodel.tenant(id),
  eservice_id UUID REFERENCES readmodel.eservice(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason VARCHAR,
  revoked_at TIMESTAMP WITH TIME ZONE,
  state VARCHAR,
  kind VARCHAR,
  -- activationContract
  -- revocationContract
  submission_who UUID NOT NULL REFERENCES readmodel.tenant(id),
  submission_when TIMESTAMP WITH TIME ZONE NOT NULL,
  activation_who UUID REFERENCES readmodel.tenant(id),
  activation_when TIMESTAMP WITH TIME ZONE,
  rejection_who UUID REFERENCES readmodel.tenant(id),
  rejection_when TIMESTAMP WITH TIME ZONE,
  revocation_who UUID REFERENCES readmodel.tenant(id),
  revocation_when TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.delegation_contract_document(
  id UUID,
  delegation_id UUID NOT NULL REFERENCES readmodel.delegation (id) ON DELETE CASCADE,
  delegation_version INTEGER NOT NULL,
  name VARCHAR,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  -- activation/revocation
  PRIMARY KEY(id)
);

-- PURPOSE
CREATE TABLE IF NOT EXISTS readmodel.purpose (
  id UUID,
  version INTEGER,
  eservice_id UUID NOT NULL REFERENCES readmodel.eservice (id),
  consumer_id UUID NOT NULL REFERENCES readmodel.tenant (id),
  delegation_id UUID REFERENCES readmodel.delegation (id),
  -- versions
  suspended_by_consumer TIMESTAMP WITH TIME ZONE,
  suspended_by_producer TIMESTAMP WITH TIME ZONE,
  title VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  -- riskAnalysisForm
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  is_free_of_charge BOOLEAN NOT NULL,
  free_of_charge_reason BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.purpose_version (
  id UUID,
  purpose_id UUID NOT NULL REFERENCES readmodel.purpose (id) ON DELETE CASCADE,
  purpose_version INTEGER,
  -- beware: this refers to metadata
  state VARCHAR NOT NULL,
  -- riskAnalysis
  risk_analysis_id CHAR,
  risk_analysis_content_type VARCHAR,
  risk_analysis_path VARCHAR,
  risk_analysis_created_at TIMESTAMP,
  daily_calls INTEGER NOT NULL,
  rejection_reason VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  first_activation_at TIMESTAMP WITH TIME ZONE,
  suspended_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id)
);

-- TODO risk analysis form
-- CLIENT
CREATE TABLE IF NOT EXISTS readmodel.client (
  id UUID,
  version INTEGER NOT NULL,
  consumer_id UUID NOT NULL REFERENCES readmodel.tenant (id),
  name VARCHAR NOT NULL,
  -- purposes
  description VARCHAR,
  -- users
  kind VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  -- keys
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.client_user (
  client_version INTEGER NOT NULL,
  client_id UUID NOT NULL REFERENCES readmodel.client (id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  PRIMARY KEY (client_id, user_id)
);

CREATE TABLE IF NOT EXISTS readmodel.client_purpose (
  client_version INTEGER NOT NULL,
  client_id UUID NOT NULL REFERENCES readmodel.client (id) ON DELETE CASCADE,
  purpose_id UUID NOT NULL REFERENCES readmodel.purpose (id),
  PRIMARY KEY (client_id, purpose_id)
);

CREATE TABLE IF NOT EXISTS readmodel.client_key (
  client_version INTEGER NOT NULL,
  client_id UUID NOT NULL REFERENCES readmodel.client (id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kid VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  encoded_pem VARCHAR NOT NULL,
  algorithm VARCHAR NOT NULL,
  use VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (kid) -- TODO: probably kid can't be primary key
);

-- PRODUCER KEYCHAIN
CREATE TABLE IF NOT EXISTS readmodel.producer_keychain (
  id UUID,
  version INTEGER NOT NULL,
  producer_id UUID NOT NULL REFERENCES readmodel.tenant (id),
  name VARCHAR NOT NULL,
  -- eservices
  description VARCHAR,
  -- users
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  -- keys
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.producer_keychain_user (
  producer_keychain_version INTEGER NOT NULL,
  producer_keychain_id UUID NOT NULL REFERENCES readmodel.producer_keychain (id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  PRIMARY KEY (producer_keychain_id, user_id)
);

CREATE TABLE IF NOT EXISTS readmodel.producer_keychain_eservice (
  producer_keychain_version INTEGER NOT NULL,
  producer_keychain_id UUID NOT NULL REFERENCES readmodel.producer_keychain (id) ON DELETE CASCADE,
  eservice_id UUID NOT NULL REFERENCES readmodel.eservice (id),
  PRIMARY KEY (producer_keychain_id, eservice_id)
);

CREATE TABLE IF NOT EXISTS readmodel.producer_keychain_key (
  producer_keychain_version INTEGER NOT NULL,
  producer_keychain_id UUID NOT NULL REFERENCES readmodel.producer_keychain (id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  kid VARCHAR NOT NULL,
  name VARCHAR NOT NULL,
  encoded_pem VARCHAR NOT NULL,
  algorithm VARCHAR NOT NULL,
  use VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (kid) -- TODO: probably kid can't be primary key
);

-- CLIENT JWK KEY
CREATE TABLE IF NOT EXISTS readmodel.client_jwk_key(
  client_id UUID NOT NULL REFERENCES readmodel.client(id),
  version INTEGER NOT NULL,
  alg VARCHAR NOT NULL,
  e VARCHAR NOT NULL,
  kid VARCHAR NOT NULL,
  kty VARCHAR NOT NULL,
  n VARCHAR NOT NULL,
  use VARCHAR NOT NULL,
  PRIMARY KEY (kid) -- same as above
);

-- PRODUCER KEYCHAIN JWK KEY
CREATE TABLE IF NOT EXISTS readmodel.producer_jwk_key(
  producer_keychain_id UUID NOT NULL REFERENCES readmodel.producer_keychain(id),
  version INTEGER NOT NULL,
  alg VARCHAR NOT NULL,
  e VARCHAR NOT NULL,
  kid VARCHAR NOT NULL,
  kty VARCHAR NOT NULL,
  n VARCHAR NOT NULL,
  use VARCHAR NOT NULL,
  PRIMARY KEY (kid) -- same as above
);