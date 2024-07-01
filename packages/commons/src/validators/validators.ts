import {
  CertifiedTenantAttribute,
  CompactTenant,
  Descriptor,
  EServiceAttribute,
  Tenant,
  TenantAttribute,
  tenantAttributeType,
} from "pagopa-interop-models";

export const filterCertifiedAttributes = (
  tenant: Tenant | CompactTenant
): CertifiedTenantAttribute[] =>
  tenant.attributes.filter(
    (att) =>
      att.type === tenantAttributeType.CERTIFIED && !att.revocationTimestamp
  ) as CertifiedTenantAttribute[];

export const attributesSatisfied = (
  descriptorAttributes: EServiceAttribute[][],
  consumerAttributeIds: Array<TenantAttribute["id"]>
): boolean =>
  descriptorAttributes.every((attributeList) => {
    const attributes = attributeList.map((a) => a.id);
    return (
      attributes.filter((a) => consumerAttributeIds.includes(a)).length > 0
    );
  });

export const certifiedAttributesSatisfied = (
  descriptor: Descriptor,
  tenant: Tenant | CompactTenant
): boolean => {
  const certifiedAttributes = filterCertifiedAttributes(tenant).map(
    (a) => a.id
  );

  return attributesSatisfied(
    descriptor.attributes.certified,
    certifiedAttributes
  );
};
