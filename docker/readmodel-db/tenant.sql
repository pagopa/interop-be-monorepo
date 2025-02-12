CREATE TABLE IF NOT EXISTS readmodel.tenant (
  id UUID,
  metadata_version INTEGER NOT NULL,
  kind VARCHAR,
  selfcare_id VARCHAR,
  external_id_origin VARCHAR NOT NULL,
  external_id_value VARCHAR NOT NULL,
  -- features
  -- attributes
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  -- mails
  name VARCHAR NOT NULL,
  onboarded_at TIMESTAMP WITH TIME ZONE,
  sub_unit_type VARCHAR,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_mail (
  id VARCHAR,
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  kind VARCHAR NOT NULL,
  address VARCHAR NULL,
  description VARCHAR NULL,
  created_at TIMESTAMP NOT NULL,
  PRIMARY KEY (id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_certified_attribute (
  attribute_id UUID REFERENCES readmodel.attribute(id),
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  assignment_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  revocation_timestamp TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (attribute_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_declared_attribute (
  attribute_id UUID,
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id),
  metadata_version INTEGER NOT NULL,
  assignment_timestamp TIMESTAMP NOT NULL,
  revocation_timestamp TIMESTAMP WITH TIME ZONE,
  delegation_id UUID,
  PRIMARY KEY (attribute_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_verified_attribute (
  attribute_id UUID,
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  assignment_timestamp TIMESTAMP NOT NULL,
  PRIMARY KEY (attribute_id, tenant_id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_verified_attribute_verifier (
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id),
  metadata_version INTEGER NOT NULL,
  id UUID REFERENCES readmodel.tenant (id),
  -- verifier id
  tenant_verified_attribute_id UUID NOT NULL REFERENCES readmodel.tenant_verified_attribute(attribute_id),
  verification_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_date TIMESTAMP WITH TIME ZONE,
  extension_date TIMESTAMP WITH TIME ZONE,
  delegation_id UUID,
  PRIMARY KEY (id, tenant_verified_attribute_id, tenant_id),
  FOREIGN KEY (tenant_id, tenant_verified_attribute_id) REFERENCES readmodel.tenant_verified_attribute (tenant_id, attribute_id)
);

CREATE TABLE IF NOT EXISTS readmodel.tenant_verified_attribute_revoker (
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id),
  metadata_version INTEGER NOT NULL,
  id UUID REFERENCES readmodel.tenant (id),
  -- revoker id
  tenant_verified_attribute_id UUID NOT NULL,
  verification_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_date TIMESTAMP WITH TIME ZONE,
  extension_date TIMESTAMP WITH TIME ZONE,
  revocation_date TIMESTAMP NOT NULL,
  delegation_id UUID,
  PRIMARY KEY (id, tenant_verified_attribute_id, tenant_id),
  FOREIGN KEY (tenant_id, tenant_verified_attribute_id) REFERENCES readmodel.tenant_verified_attribute (tenant_id, attribute_id)
);

-- TODO: how to delete a single feature if this operation will be allowed?
CREATE TABLE IF NOT EXISTS readmodel.tenant_feature(
  tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  kind VARCHAR NOT NULL,
  details JSON NOT NULL
);

-- CREATE TABLE IF NOT EXISTS readmodel.tenant_feature_certifier(
--   tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id) ON DELETE CASCADE,
--   metadata_version INTEGER NOT NULL,
--   certifier_id VARCHAR,
--   PRIMARY KEY (certifier_id)
-- );

-- CREATE TABLE IF NOT EXISTS readmodel.tenant_feature_delegated_producer(
--   tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id) ON DELETE CASCADE,
--   metadata_version INTEGER NOT NULL,
--   availability_timestamp TIMESTAMP WITH TIME ZONE,
--   PRIMARY KEY (tenant_id)
-- );

-- CREATE TABLE IF NOT EXISTS readmodel.tenant_feature_delegated_consumer(
--   tenant_id UUID NOT NULL REFERENCES readmodel.tenant (id) ON DELETE CASCADE,
--   metadata_version INTEGER NOT NULL,
--   availability_timestamp TIMESTAMP WITH TIME ZONE
-- );
