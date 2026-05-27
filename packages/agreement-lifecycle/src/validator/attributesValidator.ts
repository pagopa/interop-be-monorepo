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

type CertifiedDiscreteValidationOptions = {
  certifiedDiscreteEnabled?: boolean;
};

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
  tenantAttributes: TenantAttribute[],
  options: CertifiedDiscreteValidationOptions = {}
): boolean =>
  tenantAttributes.some((tenantAttribute) => {
    if (tenantAttribute.id !== descriptorAttribute.id) {
      return false;
    }
    if (
      "discreteConfig" in descriptorAttribute &&
      (options.certifiedDiscreteEnabled ?? true)
    ) {
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
  tenantAttributes: TenantAttribute[],
  options: CertifiedDiscreteValidationOptions = {}
): boolean =>
  descriptorAttributes.certified
    .filter((attGroup) => attGroup.length > 0)
    .every((attributeList) =>
      attributeList.some((attr) =>
        matchesCertifiedDescriptorAttribute(attr, tenantAttributes, options)
      )
    );

/*
 * Returns the suspension reason and (when applicable) the discrete attribute
 * failure detail when the tenant does not satisfy the descriptor certified
 * attributes.
 *
 * Policy: the reason reflects the first descriptor group that fails
 * (top-down). Within that group, a discrete entry is preferred for the
 * reason and the detail is populated from the tenant's current discrete
 * attribute value when available.
 */
export const certifiedAttributesFailure = (
  descriptorAttributes: Descriptor["attributes"],
  tenantAttributes: TenantAttribute[],
  options: CertifiedDiscreteValidationOptions = {}
): {
  suspensionReason: AgreementSuspensionReason | undefined;
  discreteAttributeFailure: CertifiedDiscreteAttributeFailure | undefined;
} => {
  if (
    certifiedAttributesSatisfied(
      descriptorAttributes,
      tenantAttributes,
      options
    )
  ) {
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
          matchesCertifiedDescriptorAttribute(
            attribute,
            tenantAttributes,
            options
          )
        )
    );

  if (!failingGroup) {
    return {
      suspensionReason: agreementSuspensionReason.certifiedAttribute,
      discreteAttributeFailure: undefined,
    };
  }

  const discreteEnabled = options.certifiedDiscreteEnabled ?? true;

  if (discreteEnabled) {
    for (const descriptorAttribute of failingGroup) {
      if (!("discreteConfig" in descriptorAttribute)) {
        continue;
      }
      const tenantAttribute = tenantAttributes.find(
        (attribute) => attribute.id === descriptorAttribute.id
      );
      if (tenantAttribute?.type === tenantAttributeType.CERTIFIED_DISCRETE) {
        return {
          suspensionReason:
            agreementSuspensionReason.certifiedDiscreteAttribute,
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
