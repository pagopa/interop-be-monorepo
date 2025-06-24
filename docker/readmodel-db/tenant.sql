CREATE SCHEMA IF NOT EXISTS readmodel_tenant;

CREATE TABLE IF NOT EXISTS readmodel_tenant.tenant (
  id UUID,
  metadata_version INTEGER NOT NULL,
  kind VARCHAR,
  selfcare_id VARCHAR,
  external_id_origin VARCHAR NOT NULL,
  external_id_value VARCHAR NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  name VARCHAR NOT NULL,
  onboarded_at TIMESTAMP WITH TIME ZONE,
  sub_unit_type VARCHAR,
  PRIMARY KEY (id),
  CONSTRAINT tenant_id_metadata_version_unique UNIQUE (id, metadata_version)
);

CREATE TABLE IF NOT EXISTS readmodel_tenant.tenant_mail (
  id VARCHAR,
  tenant_id UUID NOT NULL REFERENCES readmodel_tenant.tenant (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  kind VARCHAR NOT NULL,
  address VARCHAR NOT NULL,
  description VARCHAR NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (id, tenant_id, created_at),
  FOREIGN KEY (tenant_id, metadata_version) REFERENCES readmodel_tenant.tenant (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_tenant.tenant_certified_attribute (
  attribute_id UUID NOT NULL,
  tenant_id UUID NOT NULL REFERENCES readmodel_tenant.tenant (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  assignment_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  revocation_timestamp TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (attribute_id, tenant_id),
  FOREIGN KEY (tenant_id, metadata_version) REFERENCES readmodel_tenant.tenant (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_tenant.tenant_declared_attribute (
  attribute_id UUID,
  tenant_id UUID NOT NULL REFERENCES readmodel_tenant.tenant (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  assignment_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  revocation_timestamp TIMESTAMP WITH TIME ZONE,
  delegation_id UUID,
  PRIMARY KEY (attribute_id, tenant_id),
  FOREIGN KEY (tenant_id, metadata_version) REFERENCES readmodel_tenant.tenant (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_tenant.tenant_verified_attribute (
  attribute_id UUID,
  tenant_id UUID NOT NULL REFERENCES readmodel_tenant.tenant (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  assignment_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (attribute_id, tenant_id),
  FOREIGN KEY (tenant_id, metadata_version) REFERENCES readmodel_tenant.tenant (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_tenant.tenant_verified_attribute_verifier (
  tenant_id UUID NOT NULL REFERENCES readmodel_tenant.tenant (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  tenant_verifier_id UUID NOT NULL,
  tenant_verified_attribute_id UUID NOT NULL,
  verification_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_date TIMESTAMP WITH TIME ZONE,
  extension_date TIMESTAMP WITH TIME ZONE,
  delegation_id UUID,
  FOREIGN KEY (tenant_id, tenant_verified_attribute_id) REFERENCES readmodel_tenant.tenant_verified_attribute (tenant_id, attribute_id),
  FOREIGN KEY (tenant_verifier_id) REFERENCES readmodel_tenant.tenant (id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (tenant_id, metadata_version) REFERENCES readmodel_tenant.tenant (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_tenant.tenant_verified_attribute_revoker (
  tenant_id UUID NOT NULL REFERENCES readmodel_tenant.tenant (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  tenant_revoker_id UUID NOT NULL,
  tenant_verified_attribute_id UUID NOT NULL,
  verification_date TIMESTAMP WITH TIME ZONE NOT NULL,
  expiration_date TIMESTAMP WITH TIME ZONE,
  extension_date TIMESTAMP WITH TIME ZONE,
  revocation_date TIMESTAMP WITH TIME ZONE NOT NULL,
  delegation_id UUID,
  FOREIGN KEY (tenant_id, tenant_verified_attribute_id) REFERENCES readmodel_tenant.tenant_verified_attribute (tenant_id, attribute_id),
  FOREIGN KEY (tenant_revoker_id) REFERENCES readmodel_tenant.tenant (id) DEFERRABLE INITIALLY DEFERRED,
  FOREIGN KEY (tenant_id, metadata_version) REFERENCES readmodel_tenant.tenant (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);

CREATE TABLE IF NOT EXISTS readmodel_tenant.tenant_feature (
  tenant_id UUID NOT NULL REFERENCES readmodel_tenant.tenant (id) ON DELETE CASCADE,
  metadata_version INTEGER NOT NULL,
  kind VARCHAR NOT NULL,
  certifier_id VARCHAR,
  availability_timestamp TIMESTAMP WITH TIME ZONE,
  PRIMARY KEY (tenant_id, kind),
  FOREIGN KEY (tenant_id, metadata_version) REFERENCES readmodel_tenant.tenant (id, metadata_version) DEFERRABLE INITIALLY DEFERRED
);
