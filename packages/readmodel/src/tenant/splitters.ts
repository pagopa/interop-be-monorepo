import {
  Tenant,
  TenantCertifiedAttributeSQL,
  TenantDeclaredAttributeSQL,
  TenantFeatureSQL,
  TenantId,
  TenantMail,
  TenantMailSQL,
  TenantSQL,
  TenantVerifiedAttributeRevokerSQL,
  TenantVerifiedAttributeSQL,
  TenantVerifiedAttributeVerifierSQL,
} from "pagopa-interop-models";

export const splitTenantIntoObjectsSQL = (
  {
    id,
    kind,
    selfcareId,
    externalId,
    features,
    attributes,
    createdAt,
    updatedAt,
    mails,
    name,
    onboardedAt,
    subUnitType,
    ...rest
  }: Tenant,
  metadata_version: number
): {
  tenantSQL: TenantSQL;
  tenantMailsSQL: TenantMailSQL[];
  tenantCertifiedAttributesSQL: TenantCertifiedAttributeSQL[];
  tenantDeclaredAttributesSQL: TenantDeclaredAttributeSQL[];
  tenantVerifiedAttributesSQL: TenantVerifiedAttributeSQL[];
  tenantVerifiedAttributeVerifiersSQL: TenantVerifiedAttributeVerifierSQL[];
  tenantVerifiedAttributeRevokersSQL: TenantVerifiedAttributeRevokerSQL[];
  tenantFeaturesSQL: TenantFeatureSQL[];
} => {
  void (rest satisfies Record<string, never>);

  const tenantSQL: TenantSQL = {
    id,
    metadata_version,
    kind,
    selfcare_id: selfcareId,
    external_id_origin: externalId.origin,
    external_id_value: externalId.value,
    created_at: createdAt,
    updated_at: updatedAt,
    name,
    onboarded_at: onboardedAt,
    sub_unit_type: subUnitType,
  };

  const tenantMailsSQL: TenantMailSQL[] = mails.map((mail) =>
    tenantMailToTenantMailSQL(mail, id, metadata_version)
  );

  return {
    tenantSQL,
    tenantMailsSQL,
  };
};

const tenantMailToTenantMailSQL = (
  { id, kind, address, description, createdAt, ...rest }: TenantMail,
  tenantId: TenantId,
  metadata_version: number
): TenantMailSQL => {
  void (rest satisfies Record<string, never>);
  return {
    id,
    tenant_id: tenantId,
    metadata_version,
    kind,
    address,
    description,
    created_at: createdAt,
  };
};
