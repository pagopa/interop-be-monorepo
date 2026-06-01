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

export const matchesDiscreteThreshold = (
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

export const matchesCertifiedDiscreteAttribute = (
  descriptorAttribute: EServiceAttributeCertifiedDiscrete,
  tenantAttribute: TenantAttribute
): boolean =>
  tenantAttribute.id === descriptorAttribute.id &&
  tenantAttribute.type === tenantAttributeType.CERTIFIED_DISCRETE &&
  !tenantAttribute.revocationTimestamp &&
  matchesDiscreteThreshold(
    tenantAttribute.discreteValue,
    descriptorAttribute.discreteConfig.threshold,
    descriptorAttribute.discreteConfig.comparator
  );

export const matchesCertifiedDescriptorAttribute = (
  descriptorAttribute:
    | EServiceAttributeCertified
    | EServiceAttributeCertifiedDiscrete,
  tenantAttributes: TenantAttribute[]
): boolean =>
  tenantAttributes.some((tenantAttribute) => {
    if ("discreteConfig" in descriptorAttribute) {
      return matchesCertifiedDiscreteAttribute(
        descriptorAttribute,
        tenantAttribute
      );
    }
    return (
      tenantAttribute.id === descriptorAttribute.id &&
      (tenantAttribute.type === tenantAttributeType.CERTIFIED ||
        tenantAttribute.type === tenantAttributeType.CERTIFIED_DISCRETE) &&
      !tenantAttribute.revocationTimestamp
    );
  });

type CertifiedAttributeGroup = Descriptor["attributes"]["certified"][number];

// Descriptor attribute contracts allow empty groups: full descriptor updates are
// modeled as arrays of arrays, and M2M group seeds allow an empty attributeIds
// list. Catalog parsing preserves those groups, so descriptors may reach this
// validator with [] groups. They are ignored here because they carry no actual
// requirement to satisfy.
const nonEmptyCertifiedAttributeGroups = (
  descriptorAttributes: Descriptor["attributes"]
): CertifiedAttributeGroup[] =>
  descriptorAttributes.certified.filter((group) => group.length > 0);

// A certified attribute group is an OR condition: one matching attribute is
// enough to satisfy the whole group.
const tenantSatisfiesCertifiedAttributeGroup = (
  group: CertifiedAttributeGroup,
  tenantAttributes: TenantAttribute[]
): boolean =>
  group.some((attribute) =>
    matchesCertifiedDescriptorAttribute(attribute, tenantAttributes)
  );

export type CertifiedAttributesSuspension = {
  suspensionReason: AgreementSuspensionReason | undefined;
  discreteAttributeFailure: CertifiedDiscreteAttributeFailure | undefined;
};

const noCertifiedAttributesSuspension: CertifiedAttributesSuspension = {
  suspensionReason: undefined,
  discreteAttributeFailure: undefined,
};

// Extracts the detailed threshold failure when the tenant owns the discrete
// attribute but its value does not satisfy the descriptor threshold.
const findDiscreteAttributeThresholdFailureInGroup = (
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
    if (
      tenantAttribute?.type === tenantAttributeType.CERTIFIED_DISCRETE &&
      !tenantAttribute.revocationTimestamp
    ) {
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

  // 2. Something is missing, so find the first unsatisfied group: a group is an
  //    OR, so it is unsatisfied only when none of its attributes match.
  const failingGroup = nonEmptyCertifiedAttributeGroups(
    descriptorAttributes
  ).find(
    (group) => !tenantSatisfiesCertifiedAttributeGroup(group, tenantAttributes)
  );

  // 3. The tenant owns the discrete attribute, but its value is out of threshold
  //    => specific reason with details.
  const discreteFailure = failingGroup
    ? findDiscreteAttributeThresholdFailureInGroup(
        failingGroup,
        tenantAttributes
      )
    : undefined;
  if (discreteFailure) {
    return {
      suspensionReason: agreementSuspensionReason.certifiedDiscreteAttribute,
      discreteAttributeFailure: discreteFailure,
    };
  }

  // 4. A discrete attribute was required, but the tenant does not own it at all
  //    => same but without details.
  if (
    failingGroup &&
    failingGroup.some((attribute) => "discreteConfig" in attribute)
  ) {
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

export const certifiedAttributesSatisfied = (
  descriptorAttributes: Descriptor["attributes"],
  tenantAttributes: TenantAttribute[]
): boolean =>
  nonEmptyCertifiedAttributeGroups(descriptorAttributes).every((group) =>
    tenantSatisfiesCertifiedAttributeGroup(group, tenantAttributes)
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
