CREATE TABLE IF NOT EXISTS readmodel.delegation(
  id UUID,
  version INTEGER,
  delegator_id UUID,
  delegate_id UUID,
  eservice_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason VARCHAR,
  revoked_at TIMESTAMP WITH TIME ZONE,
  state VARCHAR,
  kind VARCHAR,
  -- activationContract
  -- revocationContract
  submission_who UUID NOT NULL,
  submission_when TIMESTAMP WITH TIME ZONE NOT NULL,
  activation_who UUID,
  activation_when TIMESTAMP WITH TIME ZONE,
  rejection_who UUID,
  rejection_when TIMESTAMP WITH TIME ZONE,
  revocation_who UUID,
  revocation_when TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.delegation_contract_document(
  id UUID,
  delegation_id UUID NOT NULL REFERENCES readmodel.delegation (id) ON DELETE CASCADE,
  delegation_version INTEGER NOT NULL,
  name VARCHAR,
  content_type VARCHAR NOT NULL,
  pretty_name VARCHAR NOT NULL,
  path VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  kind VARCHAR NOT NULL,
  -- activation/revocation
  PRIMARY KEY(id)
);
