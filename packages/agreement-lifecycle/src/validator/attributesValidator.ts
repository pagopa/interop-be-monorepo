import {
  AgreementSuspensionReason,
  AttributeCertifiedDiscreteComparator,
  CertifiedDiscreteAttributeFailure,
  Descriptor,
  EServiceAttribute,
  EServiceAttributeCertified,
  EServiceAttributeCertifiedDiscrete,
  TenantAttribute,
  agreementSuspensionReason,
  attributeCertifiedDiscreteComparator,
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

export const certifiedAttributesFailure = (
  descriptorAttributes: Descriptor["attributes"],
  tenantAttributes: TenantAttribute[]
): {
  suspensionReason: AgreementSuspensionReason | undefined;
  discreteAttributeFailure: CertifiedDiscreteAttributeFailure | undefined;
} => {
  if (certifiedAttributesSatisfied(descriptorAttributes, tenantAttributes)) {
    return {
      suspensionReason: undefined,
      discreteAttributeFailure: undefined,
    };
  }

  const failingGroup = descriptorAttributes.certified
    .filter((group) => group.length > 0)
    .find(
      (group) =>
        !group.some((attribute) =>
          matchesCertifiedDescriptorAttribute(attribute, tenantAttributes)
        )
    );

  if (!failingGroup) {
    return {
      suspensionReason: agreementSuspensionReason.certifiedAttribute,
      discreteAttributeFailure: undefined,
    };
  }

  for (const descriptorAttribute of failingGroup) {
    if (!("discreteConfig" in descriptorAttribute)) {
      continue;
    }
    const tenantAttribute = tenantAttributes.find(
      (attribute) => attribute.id === descriptorAttribute.id
    );
    if (tenantAttribute?.type === tenantAttributeType.CERTIFIED_DISCRETE) {
      return {
        suspensionReason: agreementSuspensionReason.certifiedDiscreteAttribute,
        discreteAttributeFailure: {
          attributeId: descriptorAttribute.id,
          tenantValue: tenantAttribute.discreteValue,
          threshold: descriptorAttribute.discreteConfig.threshold,
          comparator: descriptorAttribute.discreteConfig.comparator,
        },
      };
    }
  }

  if (failingGroup.some((attr) => "discreteConfig" in attr)) {
    return {
      suspensionReason: agreementSuspensionReason.certifiedDiscreteAttribute,
      discreteAttributeFailure: undefined,
    };
  }

  return {
    suspensionReason: agreementSuspensionReason.certifiedAttribute,
    discreteAttributeFailure: undefined,
  };
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
