CREATE SCHEMA readmodel;

-- CATALOG
CREATE TABLE readmodel.eservice(
  id uuid,
  producer_id uuid,
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

CREATE TABLE readmodel.descriptor_document(
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

/*
certified: [[a], [b,c], [d]]

a | certified | 1
b | certified | 2
c | certified | 2
d | certified | 3

*/
CREATE TABLE readmodel.eservice_risk_analysis(
  risk_analysis_id uuid,
  name varchar,
  -- to do eserviceId
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



-- alternative: one table for the answers: value always array, adding a type "single/multi"
CREATE TABLE readmodel.risk_analysis_answer(
  id uuid,
  risk_analysis_form_id uuid,
  kind varchar, -- SINGLE/MULTI
  key varchar,
  value varchar ARRAY
);


-- AGREEMENT
CREATE TABLE readmodel.agreement(
  id uuid,
  eservice_id uuid,
  descriptor_id uuid,
  producer_id uuid,
  consumer_id uuid,
  state varchar,
  suspended_by_consumer timestamp with time zone,
  suspended_by_producer timestamp with time zone,
  suspended_by_platform timestamp with time zone,
  created_at timestamp with time zone,
  updatedAt timestamp with time zone,
  consumer_notes varchar,
  -- to do contract
  -- to do stamps
  rejection_reason varchar,
  suspended_at timestamp with time zone
);

CREATE TABLE readmodel.agreement_attribute(
  attribute_id uuid,
  agreement_id uuid,
  kind varchar
);

CREATE TABLE readmodel.agreement_consumer_document(
  id uuid,
  agreement_id uuid,
  name varchar,
  pretty_name varchar,
  content_type varchar,
  path varchar,
  created_at timestamp with time zone
);
