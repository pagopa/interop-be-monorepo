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
  genericInternalError,
  TenantAttribute,
  tenantAttributeType,
  TenantId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

import {
  filterDeclaredAttributes,
  filterVerifiedAttributes,
} from "../filters/attributesFilter.js";

type CertifiedDiscreteValidationOptions = {
  certifiedDiscreteEnabled?: boolean;
};

const attributesSatisfied = (
  descriptorAttributes: EServiceAttribute[][],
  tenantAttributes: TenantAttribute["id"][]
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
  tenantAttributes: TenantAttribute[],
  options: CertifiedDiscreteValidationOptions = {}
): boolean => {
  const discreteEnabled = options.certifiedDiscreteEnabled ?? true;

  // When the feature flag is disabled, discrete descriptor attributes are
  // ignored entirely: they never count as satisfied.
  if ("discreteConfig" in descriptorAttribute && !discreteEnabled) {
    return false;
  }

  return tenantAttributes.some((tenantAttribute) => {
    if ("discreteConfig" in descriptorAttribute) {
      return matchesCertifiedDiscreteAttribute(
        descriptorAttribute,
        tenantAttribute
      );
    }
    // With discrete support disabled, a plain certified requirement is only
    // satisfied by a plain CERTIFIED tenant attribute, never by a discrete one.
    if (!discreteEnabled) {
      return (
        tenantAttribute.id === descriptorAttribute.id &&
        tenantAttribute.type === tenantAttributeType.CERTIFIED &&
        !tenantAttribute.revocationTimestamp
      );
    }
    return (
      tenantAttribute.id === descriptorAttribute.id &&
      (tenantAttribute.type === tenantAttributeType.CERTIFIED ||
        tenantAttribute.type === tenantAttributeType.CERTIFIED_DISCRETE) &&
      !tenantAttribute.revocationTimestamp
    );
  });
};

type CertifiedAttributeGroup = Descriptor["attributes"]["certified"][number];

// Returns the certified groups actually evaluated. Descriptor attribute
// contracts allow empty groups (full descriptor updates are arrays of arrays and
// M2M group seeds allow an empty attributeIds list), so empty groups are dropped
// as they carry no requirement. In addition, when the feature flag is disabled,
// discrete attributes are dropped from each group entirely, so a group made only
// of discrete attributes is ignored rather than treated as unsatisfiable.
const effectiveCertifiedGroups = (
  descriptorAttributes: Descriptor["attributes"],
  discreteEnabled: boolean
): CertifiedAttributeGroup[] =>
  descriptorAttributes.certified
    .map((group) =>
      discreteEnabled
        ? group
        : group.filter((attr) => !("discreteConfig" in attr))
    )
    .filter((group) => group.length > 0);

// A certified attribute group is an OR condition: one matching attribute is
// enough to satisfy the whole group.
const tenantSatisfiesCertifiedAttributeGroup = (
  group: CertifiedAttributeGroup,
  tenantAttributes: TenantAttribute[],
  options: CertifiedDiscreteValidationOptions = {}
): boolean =>
  group.some((attribute) =>
    matchesCertifiedDescriptorAttribute(attribute, tenantAttributes, options)
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
  tenantAttributes: TenantAttribute[],
  options: CertifiedDiscreteValidationOptions = {}
): CertifiedAttributesSuspension => {
  // 1. All certified attributes are satisfied => no suspension.
  if (
    certifiedAttributesSatisfied(
      descriptorAttributes,
      tenantAttributes,
      options
    )
  ) {
    return noCertifiedAttributesSuspension;
  }

  const discreteEnabled = options.certifiedDiscreteEnabled ?? true;

  // 2. Something is missing, so find the first unsatisfied group among the
  //    groups actually evaluated: a group is an OR, so it is unsatisfied only
  //    when none of its attributes match. We reach this point only because
  //    certifiedAttributesSatisfied returned false, so at least one evaluated
  //    group is unsatisfied and the search always succeeds.
  const failingGroup = effectiveCertifiedGroups(
    descriptorAttributes,
    discreteEnabled
  ).find(
    (group) =>
      !tenantSatisfiesCertifiedAttributeGroup(group, tenantAttributes, options)
  );
  if (!failingGroup) {
    throw genericInternalError(
      "Invariant violation: no failing certified attribute group found despite certifiedAttributesSatisfied returning false"
    );
  }

  // When the feature flag is disabled, discrete attributes are not evaluated:
  // skip the discrete-specific reasons and fall back to the generic one.
  if (discreteEnabled) {
    // 3. The tenant owns the discrete attribute, but its value is out of
    //    threshold => specific reason with details.
    const discreteFailure = findDiscreteAttributeThresholdFailureInGroup(
      failingGroup,
      tenantAttributes
    );
    if (discreteFailure) {
      return {
        suspensionReason: agreementSuspensionReason.certifiedDiscreteAttribute,
        discreteAttributeFailure: discreteFailure,
      };
    }

    // 4. A discrete attribute was required, but the tenant does not own it at
    //    all => same but without details.
    if (failingGroup.some((attribute) => "discreteConfig" in attribute)) {
      return {
        suspensionReason: agreementSuspensionReason.certifiedDiscreteAttribute,
        discreteAttributeFailure: undefined,
      };
    }
  }

  // 5. A plain certified attribute was missing => generic reason.
  return {
    suspensionReason: agreementSuspensionReason.certifiedAttribute,
    discreteAttributeFailure: undefined,
  };
};

export const certifiedAttributesSatisfied = (
  descriptorAttributes: Descriptor["attributes"],
  tenantAttributes: TenantAttribute[],
  options: CertifiedDiscreteValidationOptions = {}
): boolean => {
  const discreteEnabled = options.certifiedDiscreteEnabled ?? true;
  return effectiveCertifiedGroups(descriptorAttributes, discreteEnabled).every(
    (group) =>
      tenantSatisfiesCertifiedAttributeGroup(group, tenantAttributes, options)
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
