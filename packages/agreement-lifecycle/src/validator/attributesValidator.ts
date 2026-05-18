import {
  Descriptor,
  TenantId,
  EServiceAttribute,
  TenantAttribute,
} from "pagopa-interop-models";
import {
  filterCertifiedAttributes,
  filterDeclaredAttributes,
  filterVerifiedAttributes,
} from "../filters/attributesFilter.js";

const attributesSatisfied = (
  descriptorAttributes: EServiceAttribute[][],
  tenantAttributes: Array<TenantAttribute["id"]>
): boolean =>
  descriptorAttributes
    .filter((attGroup) => attGroup.length > 0)
    .every((attributeList) => {
      const attributes = attributeList.map((a) => a.id);
      return attributes.filter((a) => tenantAttributes.includes(a)).length > 0;
    });

export const certifiedAttributesSatisfied = (
  descriptorAttributes: Descriptor["attributes"],
  tenantAttributes: TenantAttribute[]
): boolean => {
  // TODO(PIN-9889, Work Item 5): extend this check to evaluate
  // certified discrete attributes with threshold/comparator. Work Item 1 only
  // introduces the shared descriptor model where certified and
  // certified discrete attributes coexist in the same descriptor array.
  const certifiedAttributes = filterCertifiedAttributes(tenantAttributes).map(
    (a) => a.id
  );

  return attributesSatisfied(
    descriptorAttributes.certified,
    certifiedAttributes
  );
};

export const declaredAttributesSatisfied = (
  descriptorAttributes: Descriptor["attributes"],
  tenantAttributes: TenantAttribute[]
): boolean => {
  const declaredAttributes = filterDeclaredAttributes(tenantAttributes).map(
    (a) => a.id
  );

  return attributesSatisfied(descriptorAttributes.declared, declaredAttributes);
};

export const verifiedAttributesSatisfied = (
  producerId: TenantId,
  descriptorAttributes: Descriptor["attributes"],
  tenantAttributes: TenantAttribute[]
): boolean => {
  const verifiedAttributes = filterVerifiedAttributes(
    producerId,
    tenantAttributes
  ).map((a) => a.id);

  return attributesSatisfied(descriptorAttributes.verified, verifiedAttributes);
};
