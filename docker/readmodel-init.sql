CREATE SCHEMA readmodel;

-- CATALOG
CREATE TABLE readmodel.eservice(
  id uuid,
  producer_id UUID,
  name varchar,
  description varchar,
  technology varchar,
  -- descriptors
  created_at timestamp with time zone,
  -- to do riskAnalysis
  mode varchar,
  PRIMARY KEY(id)
);

CREATE TABLE readmodel.descriptor(
  id uuid,
  eservice_id uuid,
  version varchar,
  description varchar,
  -- interface
  -- docs
  state varchar,
  audience varchar ARRAY,
  voucher_lifespan integer,
  daily_calls_per_consumer integer,
  daily_calls_total integer,
  agreement_approval_policy varchar,
  created_at timestamp with time zone,
  server_urls varchar ARRAY,
  published_at timestamp with time zone,
  suspended_at timestamp with time zone,
  deprecated_at timestamp with time zone,
  archived_at timestamp with time zone
  -- attributes
);

CREATE TABLE readmodel.document(
  id uuid,
  descriptor_id uuid,
  name varchar,
  content_type varchar,
  pretty_name varchar,
  path varchar,
  checksum varchar,
  upload_date timestamp with time zone,
  document_kind varchar -- differs from model
);

CREATE TABLE readmodel.descriptor_attribute(
  attribute_id uuid,
  descriptor_id uuid,
  explicit_attribute_verification boolean,
  kind varchar, -- differs from model
  group_set integer
);

CREATE TABLE readmodel.eservice_risk_analysis(
  risk_analysis_id uuid,
  name varchar,
  created_at timestamp with time zone,
  risk_analysis_form_id uuid,
  risk_analysis_form_version varchar
);

CREATE TABLE readmodel.risk_analysis_single_answer(
  id uuid,
  risk_analysis_form_id uuid,
  key varchar,
  value varchar
);

CREATE TABLE readmodel.risk_analysis_multi_answer(
  id uuid,
  risk_analysis_form_id uuid,
  key varchar,
  value varchar ARRAY
);
