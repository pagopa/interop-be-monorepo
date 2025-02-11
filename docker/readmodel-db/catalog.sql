CREATE TABLE IF NOT EXISTS readmodel.eservice (
  id UUID,
  metadata_version INTEGER NOT NULL,
  producer_id UUID NOT NULL,
  name VARCHAR NOT NULL,
  description VARCHAR NOT NULL,
  technology VARCHAR NOT NULL,
  -- attributes (moved to descriptors)
  -- descriptors
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  -- riskAnalysis
  mode VARCHAR NOT NULL,
  is_signal_hub_enabled BOOLEAN,
  is_consumer_delegable BOOLEAN,
  is_client_access_delegable BOOLEAN,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_template_binding (
  eservice_id UUID REFERENCES readmodel.eservice(id),
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

CREATE TABLE IF NOT EXISTS readmodel.eservice_descriptor (
  id UUID,
  eservice_id UUID NOT NULL references readmodel.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
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
  -- rejection_reasons
  PRIMARY KEY (id)
);

-- TODO: what's the PK?
CREATE TABLE IF NOT EXISTS readmodel.eservice_descriptor_rejection_reason (
  eservice_id UUID NOT NULL REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  descriptor_id UUID NOT NULL REFERENCES readmodel.eservice_descriptor (id) ON DELETE CASCADE,
  rejection_reason VARCHAR NOT NULL,
  rejected_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_descriptor_document(
  id UUID,
  eservice_id UUID NOT NULL REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  descriptor_id UUID NOT NULL REFERENCES readmodel.eservice_descriptor(id) ON DELETE CASCADE,
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
 attr, kind, group_id
 a | certified | 1
 b | certified | 2
 c | certified | 2
 d | certified | 3
 */
CREATE TABLE IF NOT EXISTS readmodel.eservice_descriptor_attribute(
  attribute_id UUID NOT NULL,
  eservice_id UUID NOT NULL REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  descriptor_id UUID NOT NULL REFERENCES readmodel.eservice_descriptor(id) ON DELETE CASCADE,
  explicit_attribute_verification BOOLEAN NOT NULL,
  kind VARCHAR NOT NULL,
  -- CERTIFIED/DECLARED/VERIFIED
  group_id INTEGER NOT NULL,
  -- id of the group
  PRIMARY KEY(attribute_id, descriptor_id, group_id)
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_risk_analysis(
  id UUID,
  eservice_id UUID REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  name VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE,
  risk_analysis_form_id UUID UNIQUE,
  risk_analysis_form_version VARCHAR,
  PRIMARY KEY(id)
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_risk_analysis_answer(
  id UUID,
  eservice_id UUID REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  risk_analysis_form_id UUID REFERENCES readmodel.eservice_risk_analysis (risk_analysis_form_id),
  kind VARCHAR,
  -- SINGLE/MULTI
  key VARCHAR,
  value VARCHAR ARRAY,
  PRIMARY KEY(id)
);

