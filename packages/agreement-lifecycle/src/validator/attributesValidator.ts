import {
  agreementSuspensionReason,
  AgreementSuspensionReason,
  attributeCertifiedDiscreteComparator,
  AttributeCertifiedDiscreteComparator,
  CertifiedDiscreteAttributeFailure,
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

type CertifiedAttributeGroup = Descriptor["attributes"]["certified"][number];

export type CertifiedAttributesSuspension = {
  suspensionReason: AgreementSuspensionReason | undefined;
  discreteAttributeFailure: CertifiedDiscreteAttributeFailure | undefined;
};

const noCertifiedAttributesSuspension: CertifiedAttributesSuspension = {
  suspensionReason: undefined,
  discreteAttributeFailure: undefined,
};

const findUnsatisfiedCertifiedGroup = (
  descriptorAttributes: Descriptor["attributes"],
  tenantAttributes: TenantAttribute[]
): CertifiedAttributeGroup | undefined =>
  descriptorAttributes.certified
    .filter((group) => group.length > 0)
    .find(
      (group) =>
        !group.some((attribute) =>
          matchesCertifiedDescriptorAttribute(attribute, tenantAttributes)
        )
    );

const groupRequiresDiscreteAttribute = (
  group: CertifiedAttributeGroup
): boolean => group.some((attribute) => "discreteConfig" in attribute);

const findDiscreteThresholdFailure = (
  failingGroup: CertifiedAttributeGroup,
  tenantAttributes: TenantAttribute[]
): CertifiedDiscreteAttributeFailure | undefined => {
  for (const descriptorAttribute of failingGroup) {
    if (!("discreteConfig" in descriptorAttribute)) {
      continue;
    }
    const tenantAttribute = tenantAttributes.find(
      (attribute) => attribute.id === descriptorAttribute.id
    );
    if (tenantAttribute?.type === tenantAttributeType.CERTIFIED_DISCRETE) {
      return {
        attributeId: descriptorAttribute.id,
        tenantValue: tenantAttribute.discreteValue,
        threshold: descriptorAttribute.discreteConfig.threshold,
        comparator: descriptorAttribute.discreteConfig.comparator,
      };
    }
  }
  return undefined;
};

// Evaluates the descriptor's certified attributes against the tenant's and, when
// they are not satisfied, returns the MOST SPECIFIC suspension reason possible
export const evaluateCertifiedAttributesSuspension = (
  descriptorAttributes: Descriptor["attributes"],
  tenantAttributes: TenantAttribute[]
): CertifiedAttributesSuspension => {
  // 1. All certified attributes are satisfied => no suspension.
  if (certifiedAttributesSatisfied(descriptorAttributes, tenantAttributes)) {
    return noCertifiedAttributesSuspension;
  }

  // 2. Something is missing so find the first unsatisfied group.
  const failingGroup = findUnsatisfiedCertifiedGroup(
    descriptorAttributes,
    tenantAttributes
  );

  // 3. The tenant owns the discrete attribute, but its value is out of threshold
  //    => specific reason with details.
  const discreteFailure = failingGroup
    ? findDiscreteThresholdFailure(failingGroup, tenantAttributes)
    : undefined;
  if (discreteFailure) {
    return {
      suspensionReason: agreementSuspensionReason.certifiedDiscreteAttribute,
      discreteAttributeFailure: discreteFailure,
    };
  }

  // 4. A discrete attribute was required, but the tenant does not own it at all
  //    => same but without details.
  if (failingGroup && groupRequiresDiscreteAttribute(failingGroup)) {
    return {
      suspensionReason: agreementSuspensionReason.certifiedDiscreteAttribute,
      discreteAttributeFailure: undefined,
    };
  }

  // 5. A plain certified attribute was missing => generic reason.
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
