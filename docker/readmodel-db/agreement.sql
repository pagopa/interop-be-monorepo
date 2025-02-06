CREATE TABLE IF NOT EXISTS readmodel.agreement(
  id uuid,
  version integer NOT NULL,
  eservice_id uuid NOT NULL,
  descriptor_id uuid NOT NULL,
  producer_id UUID NOT NULL,
  consumer_id UUID NOT NULL,
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

CREATE TABLE IF NOT EXISTS readmodel.agreement_attribute(
  agreement_id uuid REFERENCES readmodel.agreement(id) ON DELETE CASCADE,
  agreement_version integer NOT NULL,
  attribute_id uuid,
  kind varchar NOT NULL,
  PRIMARY KEY (agreement_id, attribute_id)
);

CREATE TABLE IF NOT EXISTS readmodel.agreement_document(
  id uuid,
  agreement_id uuid REFERENCES readmodel.agreement(id) ON DELETE CASCADE,
  agreement_version integer NOT NULL,
  name varchar NOT NULL,
  pretty_name varchar NOT NULL,
  content_type varchar NOT NULL,
  path varchar NOT NULL,
  created_at timestamp with time zone NOT NULL,
  kind varchar NOT NULL,
  -- consumerDoc / contract
  PRIMARY KEY (id)
);
