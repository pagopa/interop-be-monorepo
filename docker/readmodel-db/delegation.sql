CREATE TABLE IF NOT EXISTS readmodel.delegation(
  id UUID,
  metadata_version INTEGER NOT NULL,
  delegator_id UUID NOT NULL,
  delegate_id UUID NOT NULL,
  eservice_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason VARCHAR,
  revoked_at TIMESTAMP WITH TIME ZONE,
  state VARCHAR NOT NULL,
  kind VARCHAR NOT NULL,
  -- activationContract
  -- revocationContract
  -- stamps
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.delegation_stamp(
  delegation_id uuid NOT NULL REFERENCES readmodel.delegation(id) ON DELETE CASCADE,
  metadata_version integer NOT NULL,
  who uuid NOT NULL,
  "when" timestamp WITH time zone NOT NULL,
  kind varchar NOT NULL,
  PRIMARY KEY (delegation_id, kind)
);

CREATE TABLE IF NOT EXISTS readmodel.delegation_contract_document(
  id UUID,
  delegation_id UUID NOT NULL REFERENCES readmodel.delegation (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  name VARCHAR NOT NULL,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  -- activation/revocation
  PRIMARY KEY(id)
);
