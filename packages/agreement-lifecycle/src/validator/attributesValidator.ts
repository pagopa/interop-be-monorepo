import {
  Descriptor,
  CompactTenant,
  Tenant,
  TenantId,
  EServiceAttribute,
  TenantAttribute,
} from "pagopa-interop-models";
import {
  filterCertifiedAttributes,
  filterDeclaredAttributes,
  filterVerifiedAttributes,
} from "../filters/attributesFilter.js";
import { DescriptorWithOnlyAttributes, TenantWithOnlyAttributes } from "../models/models.js";

const attributesSatisfied = (
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
  descriptor: DescriptorWithOnlyAttributes,
  tenant: TenantWithOnlyAttributes
): boolean => {
  const certifiedAttributes = filterCertifiedAttributes(tenant).map(
    (a) => a.id
  );

  return attributesSatisfied(
    descriptor.attributes.certified,
    certifiedAttributes
  );
};

export const declaredAttributesSatisfied = (
  descriptor: Descriptor,
  tenant: Tenant | CompactTenant
): boolean => {
  const declaredAttributes = filterDeclaredAttributes(tenant).map((a) => a.id);

  return attributesSatisfied(
    descriptor.attributes.declared,
    declaredAttributes
  );
};

export const verifiedAttributesSatisfied = (
  producerId: TenantId,
  descriptor: Descriptor,
  tenant: Tenant | CompactTenant
): boolean => {
  const verifiedAttributes = filterVerifiedAttributes(producerId, tenant).map(
    (a) => a.id
  );

  return attributesSatisfied(
    descriptor.attributes.verified,
    verifiedAttributes
  );
};
