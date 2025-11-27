CREATE SCHEMA IF NOT EXISTS readmodel_agreement;

CREATE TABLE IF NOT EXISTS readmodel_agreement.agreement (
  id UUID,
  metadata_version INTEGER NOT NULL,
  eservice_id UUID NOT NULL,
  descriptor_id UUID NOT NULL,
  producer_id UUID NOT NULL,
  consumer_id UUID NOT NULL,
  state VARCHAR NOT NULL,
  suspended_by_consumer BOOLEAN,
  suspended_by_producer BOOLEAN,
  suspended_by_platform BOOLEAN,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  consumer_notes VARCHAR,
  rejection_reason VARCHAR,
  suspended_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id),
  CONSTRAINT agreement_id_metadata_version_unique UNIQUE (id, metadata_version)
);

CREATE TABLE IF NOT EXISTS readmodel_agreement.agreement_stamp (
  agreement_id UUID NOT NULL REFERENCES readmodel_agreement.agreement (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  who UUID NOT NULL,
  delegation_id UUID,
  "when" TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  PRIMARY KEY (agreement_id, kind),
  FOREIGN KEY (agreement_id, metadata_version) REFERENCES readmodel_agreement.agreement (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_agreement.agreement_attribute (
  agreement_id UUID NOT NULL REFERENCES readmodel_agreement.agreement (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  attribute_id UUID NOT NULL,
  kind VARCHAR NOT NULL,
  PRIMARY KEY (agreement_id, attribute_id),
  FOREIGN KEY (agreement_id, metadata_version) REFERENCES readmodel_agreement.agreement (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_agreement.agreement_consumer_document (
  id UUID,
  agreement_id UUID NOT NULL REFERENCES readmodel_agreement.agreement (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id),
  FOREIGN KEY (agreement_id, metadata_version) REFERENCES readmodel_agreement.agreement (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_agreement.agreement_contract (
  id UUID,
  agreement_id UUID UNIQUE NOT NULL REFERENCES readmodel_agreement.agreement (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (agreement_id, id),
  FOREIGN KEY (agreement_id, metadata_version) REFERENCES readmodel_agreement.agreement (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_agreement.agreement_signed_contract (
  id UUID,
  agreement_id UUID UNIQUE NOT NULL REFERENCES readmodel_agreement.agreement (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (agreement_id, id), 
  FOREIGN KEY (agreement_id, metadata_version) REFERENCES readmodel_agreement.agreement (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);