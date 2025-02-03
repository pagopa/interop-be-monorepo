CREATE SCHEMA readmodel;

-- TODO use tenants table for producerId reference
CREATE TABLE IF NOT EXISTS readmodel.eservice (
  id UUID,
  version INTEGER NOT NULL,
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
  is_delegable BOOLEAN,
  is_client_access_delegable BOOLEAN,
  PRIMARY KEY (id)
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
  -- rejection_reasons
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
  kind VARCHAR NOT NULL, -- INTERFACE/DOCUMENT
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
  kind VARCHAR NOT NULL, -- CERTIFIED/DECLARED/VERIFIED
  group_id INTEGER NOT NULL, -- id of the group
  sorting_id INTEGER NOT NULL, -- index of the attribute inside its group
  PRIMARY KEY(id, descriptor_id) -- TODO verify if the same attribute can be assigned twice in the same descriptor
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_risk_analysis(
  id UUID,
  eservice_id UUID REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version INTEGER,
  name VARCHAR,
  created_at TIMESTAMP WITH TIME ZONE,
  risk_analysis_form_id UUID,
  risk_analysis_form_version VARCHAR,
  PRIMARY KEY(id)
);

CREATE TABLE IF NOT EXISTS readmodel.eservice_risk_analysis_answer(
  id UUID,
  eservice_id UUID REFERENCES readmodel.eservice (id) ON DELETE CASCADE,
  eservice_version INTEGER,
  risk_analysis_form_id UUID, -- REFERENCES readmodel.eservice_risk_analysis (risk_analysis_form_id) -- risk_analysis_form_id IS NOT PK
  kind VARCHAR, -- SINGLE/MULTI
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
  producer_id uuid NOT NULL,
  consumer_id uuid NOT NULL,
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
  --stamps

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
  archiving_when timestamp with time zone,   archiving_delegation_id uuid,

  rejection_reason varchar,
  suspended_at timestamp with time zone,

);

 CREATE TABLE readmodel.agreement_attribute(
  agreement_id uuid REFERENCES readmodel.agreement(id),
  agreement_version integer NOT NULL,
  attribute_id uuid,
  kind varchar NOT NULL,
  PRIMARY KEY (agreement_id, attribute_id)
 );

 CREATE TABLE readmodel.agreement_consumer_document(
   id uuid,
   agreement_id uuid REFERENCES readmodel.agreement(id),
   agreement_version integer NOT NULL,
   name varchar NOT NULL,
   pretty_name varchar NOT NULL,
   content_type varchar NOT NULL,
   path varchar NOT NULL,
   created_at timestamp with time zone NOT NULL,
   kind varchar NOT NULL -- consumerDoc / contract
 );