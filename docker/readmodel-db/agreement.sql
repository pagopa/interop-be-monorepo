CREATE SCHEMA IF NOT EXISTS readmodel_agreement;

CREATE TABLE IF NOT EXISTS readmodel_agreement.agreement(
  id uuid,
  metadata_version integer NOT NULL,
  eservice_id uuid NOT NULL,
  descriptor_id uuid NOT NULL,
  producer_id UUID NOT NULL,
  consumer_id UUID NOT NULL,
  state varchar NOT NULL,
  suspended_by_consumer boolean,
  suspended_by_producer boolean,
  suspended_by_platform boolean,
  created_at timestamp WITH time zone NOT NULL,
  updated_at timestamp WITH time zone,
  consumer_notes varchar,
  rejection_reason varchar,
  suspended_at timestamp WITH time zone,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel_agreement.agreement_stamp(
  agreement_id uuid NOT NULL REFERENCES readmodel_agreement.agreement(id) ON DELETE CASCADE,
  metadata_version integer NOT NULL,
  who uuid NOT NULL,
  delegation_id uuid,
  "when" timestamp WITH time zone NOT NULL,
  kind varchar NOT NULL,
  PRIMARY KEY (agreement_id, kind)
);

CREATE TABLE IF NOT EXISTS readmodel_agreement.agreement_attribute(
  agreement_id uuid NOT NULL REFERENCES readmodel_agreement.agreement(id) ON DELETE CASCADE,
  metadata_version integer NOT NULL,
  attribute_id uuid NOT NULL,
  kind varchar NOT NULL,
  PRIMARY KEY (agreement_id, attribute_id)
);

CREATE TABLE IF NOT EXISTS readmodel_agreement.agreement_document(
  id uuid,
  agreement_id uuid NOT NULL REFERENCES readmodel_agreement.agreement(id) ON DELETE CASCADE,
  metadata_version integer NOT NULL,
  name varchar NOT NULL,
  pretty_name varchar NOT NULL,
  content_type varchar NOT NULL,
  path varchar NOT NULL,
  created_at timestamp WITH time zone NOT NULL,
  kind varchar NOT NULL,
  PRIMARY KEY (id)
);
