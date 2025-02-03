CREATE SCHEMA readmodel;
-- TODO use tenants table for producerId reference


CREATE TABLE IF NOT EXISTS readmodel.eservice (
  id uuid,
  version integer NOT NULL,
  producer_id uuid NOT NULL,
  name varchar NOT NULL,
  description varchar NOT NULL,
  technology varchar NOT NULL,
  -- attributes (moved to descriptors)
  -- descriptors
  created_at timestamp with time zone NOT NULL,
  -- riskAnalysis
  mode varchar NOT NULL,
  is_signal_hub_enabled boolean,
  is_delegable boolean,
  is_client_access_delegable boolean,
  PRIMARY KEY (id)
  );


CREATE TABLE IF NOT EXISTS readmodel.descriptor (
    id uuid,
    eservice_id uuid NOT NULL references readmodel.eservice (id) ON DELETE CASCADE,
    eservice_version integer NOT NULL,
    version varchar NOT NULL,
    description varchar NOT NULL,
    -- interface
    -- docs
    state varchar NOT NULL,
    audience varchar ARRAY NOT NULL,
    voucher_lifespan integer NOT NULL,
    daily_calls_per_consumer integer NOT NULL,
    daily_calls_total integer NOT NULL,
    agreement_approval_policy varchar,
    created_at timestamp with time zone NOT NULL,
    server_urls varchar ARRAY NOT NULL,
    published_at timestamp with time zone,
    suspended_at timestamp with time zone,
    deprecated_at timestamp with time zone,
    archived_at timestamp with time zone,
      -- attributes
      -- rejection_reasons
    PRIMARY KEY (id)
  );

CREATE TABLE IF NOT EXISTS readmodel.rejection_reason (
    id uuid,
    eservice_id uuid NOT NULL REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
    eservice_version integer,
    descriptor_id uuid NOT NULL REFERENCES readmodel.descriptor (id) ON DELETE CASCADE,
    rejection_reason varchar NOT NULL,
    rejected_at timestamp with time zone  NOT NULL,
    PRIMARY KEY (id)
  );

CREATE TABLE readmodel.descriptor_document(
   id uuid,
   eservice_id uuid NOT NULL REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version integer NOT NULL,

   descriptor_id uuid NOT NULL REFERENCES readmodel.descriptor(id) ON DELETE CASCADE,
   name varchar,
   content_type varchar NOT NULL,
   pretty_name varchar NOT NULL,
   path varchar NOT NULL,
   checksum varchar NOT NULL,
   upload_date timestamp with time zone NOT NULL,
   kind varchar NOT NULL, -- INTERFACE/DOCUMENT
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
  id uuid,
  eservice_id uuid NOT NULL REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version NOT NULL integer,
  descriptor_id uuid NOT NULL REFERENCES readmodel.descriptor(id) ON DELETE CASCADE,
  explicit_attribute_verification NOT NULL boolean,
  kind varchar NOT NULL, -- CERTIFIED/DECLARED/VERIFIED
  group_id integer NOT NULL, -- id of the group
  sorting_id integer NOT NULL, -- index of the attribute inside its group
  PRIMARY KEY(id, descriptor_id) -- TODO verify if the same attribute can be assigned twice in the same descriptor
 );


 CREATE TABLE IF NOT EXISTS readmodel.eservice_risk_analysis(
  id uuid,
  eservice_id uuid REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version integer,
   name varchar,
   created_at timestamp with time zone,
   risk_analysis_form_id uuid,
   risk_analysis_form_version varchar,
   PRIMARY KEY(id)
 );


 CREATE TABLE IF NOT EXISTS readmodel.eservice_risk_analysis_answer(
  id uuid,
  eservice_id uuid REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version integer,

   risk_analysis_form_id uuid REFERENCES readmodel.eservice_risk_analysis.risk_analysis_form_id,
   kind varchar, -- SINGLE/MULTI
   key varchar,
   value varchar ARRAY,
   PRIMARY KEY(id)
 );
