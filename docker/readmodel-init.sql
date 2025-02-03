CREATE TABLE IF NOT EXISTS readmodel.eservice (
  id uuid,
  version integer,
  producer_id uuid,
  name varchar,
  description varchar,
  technology varchar,
  -- attributes (moved to descriptors)
  -- descriptors
  created_at timestamp with time zone,
  -- riskAnalysis
  mode varchar,
  is_signal_hub_enabled boolean,
  is_delegable boolean,
  is_client_access_delegable boolean,
  PRIMARY KEY (id)
  );

CREATE TABLE IF NOT EXISTS readmodel.descriptor (
    id uuid,
    eservice_id uuid references readmodel.eservice (id) ONDELETE CASCADE,
    eservice_version integer,
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
    archived_at timestamp with time zone,
      -- attributes
      -- rejection_reasons
  );

CREATE TABLE IF NOT EXISTS readmodel.rejection_reason (
    id uuid,
    eservice_id uuid REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
    eservice_version integer,
    descriptor_id uuid REFERENCES readmodel.descriptor (id) ON DELETE CASCADE,
    rejection_reason varchar,
    rejected_at timestamp with time zone
  );

CREATE TABLE readmodel.descriptor_document(
   id uuid,
   eservice_id uuid REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version integer,

   descriptor_id uuid REFERENCES readmodel.descriptor(id) ON DELETE CASCADE,
   name varchar,
   content_type varchar,
   pretty_name varchar,
   path varchar,
   checksum varchar,
   upload_date timestamp with time zone,
   kind varchar, -- INTERFACE/DOCUMENT
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
  eservice_id uuid REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version integer,
  descriptor_id uuid REFERENCES readmodel.descriptor(id) ON DELETE CASCADE,
  explicit_attribute_verification boolean,
  kind varchar, -- CERTIFIED/DECLARED/VERIFIED
  group_id integer, -- id of the group
  sorting_id integer, -- index of the attribute inside its group
  PRIMARY KEY(attribute_id, descriptor_id)
 );


 CREATE TABLE IF NOT EXISTS readmodel.eservice_risk_analysis(
  id uuid,
  eservice_id uuid REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version integer,


   eservice_id uuid REFERENCES readmodel.eservice(id) ON DELETE CASCADE,
   name varchar,
   created_at timestamp with time zone,
   risk_analysis_form_id uuid,
   risk_analysis_form_version varchar,
   PRIMARY KEY(risk_analysis_id)
 );


 CREATE TABLE IF NOT EXISTS readmodel.eservice_risk_analysis_answer(
  id uuid,
  eservice_id uuid REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version integer,

   risk_analysis_form_id uuid,
   kind varchar, -- SINGLE/MULTI
   key varchar,
   value varchar ARRAY,
   PRIMARY KEY(id)
 );