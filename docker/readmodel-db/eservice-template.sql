CREATE TABLE IF NOT EXISTS readmodel.eservice_template (
  id UUID,
  metadata_version INTEGER NOT NULL,
  creator_id UUID NOT NULL,
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
  metadata_version INTEGER NOT NULL,
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

CREATE TABLE IF NOT EXISTS readmodel.eservice_template_version_document(
  id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  eservice_template_version_id UUID NOT NULL REFERENCES readmodel.eservice_template_version(id) ON DELETE CASCADE,
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
CREATE TABLE IF NOT EXISTS readmodel.eservice_template_version_attribute(
  id UUID,
  eservice_template_id UUID NOT NULL REFERENCES readmodel.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  eservice_template_version_id UUID NOT NULL REFERENCES readmodel.eservice_template_version(id) ON DELETE CASCADE,
  explicit_attribute_verification BOOLEAN NOT NULL,
  kind VARCHAR NOT NULL,
  -- CERTIFIED/DECLARED/VERIFIED
  group_id INTEGER NOT NULL,
  -- id of the group
  PRIMARY KEY(id, eservice_template_version_id, group_id) -- TODO verify if the same attribute can be assigned twice in the same eservice_template_version
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_template_risk_analysis(
  id UUID,
  eservice_template_id UUID REFERENCES readmodel.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER,
  name VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE,
  risk_analysis_form_id UUID UNIQUE,
  risk_analysis_form_version VARCHAR,
  PRIMARY KEY(id)
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_template_risk_analysis_answer(
  id UUID,
  eservice_template_id UUID REFERENCES readmodel.eservice_template (id) ON DELETE CASCADE,
  metadata_version INTEGER,
  risk_analysis_form_id UUID REFERENCES readmodel.eservice_risk_analysis (risk_analysis_form_id),
  kind VARCHAR,
  -- SINGLE/MULTI
  key VARCHAR,
  value VARCHAR ARRAY,
  PRIMARY KEY(id)
);
