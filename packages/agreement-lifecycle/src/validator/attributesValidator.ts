import {
  AttributeCertifiedDiscreteComparator,
  attributeCertifiedDiscreteComparator,
  Descriptor,
  EServiceAttribute,
  EServiceAttributeCertified,
  EServiceAttributeCertifiedDiscrete,
  TenantAttribute,
  tenantAttributeType,
  TenantId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import {
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

export const discreteComparatorMatches = (
  value: number,
  threshold: number,
  comparator: AttributeCertifiedDiscreteComparator
): boolean =>
  match(comparator)
    .with(attributeCertifiedDiscreteComparator.GT, () => value > threshold)
    .with(attributeCertifiedDiscreteComparator.LT, () => value < threshold)
    .with(attributeCertifiedDiscreteComparator.EQ, () => value === threshold)
    .with(attributeCertifiedDiscreteComparator.GTE, () => value >= threshold)
    .with(attributeCertifiedDiscreteComparator.LTE, () => value <= threshold)
    .with(attributeCertifiedDiscreteComparator.NE, () => value !== threshold)
    .exhaustive();

export const matchesCertifiedDescriptorAttribute = (
  descriptorAttribute:
    | EServiceAttributeCertified
    | EServiceAttributeCertifiedDiscrete,
  tenantAttributes: TenantAttribute[]
): boolean =>
  tenantAttributes.some((tenantAttribute) => {
    if (tenantAttribute.id !== descriptorAttribute.id) {
      return false;
    }
    if ("discreteConfig" in descriptorAttribute) {
      return (
        tenantAttribute.type === tenantAttributeType.CERTIFIED_DISCRETE &&
        !tenantAttribute.revocationTimestamp &&
        discreteComparatorMatches(
          tenantAttribute.discreteValue,
          descriptorAttribute.discreteConfig.threshold,
          descriptorAttribute.discreteConfig.comparator
        )
      );
    }
    return (
      (tenantAttribute.type === tenantAttributeType.CERTIFIED ||
        tenantAttribute.type === tenantAttributeType.CERTIFIED_DISCRETE) &&
      !tenantAttribute.revocationTimestamp
    );
  });

export const certifiedAttributesSatisfied = (
  descriptorAttributes: Descriptor["attributes"],
  tenantAttributes: TenantAttribute[]
): boolean =>
  descriptorAttributes.certified
    .filter((attGroup) => attGroup.length > 0)
    .every((attributeList) =>
      attributeList.some((attr) =>
        matchesCertifiedDescriptorAttribute(attr, tenantAttributes)
      )
    );

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
