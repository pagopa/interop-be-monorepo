CREATE SCHEMA IF NOT EXISTS readmodel_delegation;

CREATE TABLE IF NOT EXISTS readmodel_delegation.delegation (
  id UUID,
  metadata_version INTEGER NOT NULL,
  delegator_id UUID NOT NULL,
  delegate_id UUID NOT NULL,
  eservice_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  rejection_reason VARCHAR,
  state VARCHAR NOT NULL,
  kind VARCHAR NOT NULL,
  signed_contract UUID,
  PRIMARY KEY (id),
  CONSTRAINT delegation_id_metadata_version_unique UNIQUE (id, metadata_version)
);

CREATE TABLE IF NOT EXISTS readmodel_delegation.delegation_stamp (
  delegation_id UUID NOT NULL REFERENCES readmodel_delegation.delegation (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  who UUID NOT NULL,
  "when" TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  PRIMARY KEY (delegation_id, kind),
  FOREIGN KEY (delegation_id, metadata_version) REFERENCES readmodel_delegation.delegation (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_delegation.delegation_contract_document (
  id UUID,
  delegation_id UUID NOT NULL REFERENCES readmodel_delegation.delegation (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  signed_at TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id),
  FOREIGN KEY (delegation_id, metadata_version) REFERENCES readmodel_delegation.delegation (id, metadata_version) DEFERRABLE INITIALLY DEFERRED,
  CONSTRAINT delegation_contract_document_delegation_id_kind_unique UNIQUE (delegation_id, kind)
);
