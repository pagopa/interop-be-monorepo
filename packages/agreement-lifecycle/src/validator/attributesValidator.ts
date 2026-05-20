import {
  AgreementSuspensionReason,
  AttributeCertifiedDiscreteComparator,
  AttributeId,
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

/*
 * Returns the suspension reason and (when applicable) the discrete attribute
 * failure detail for a recompute triggered by `triggeringAttributeId`.
 *
 * Policy: the triggering attribute is the one whose change caused the
 * recompute, so it is treated as the failure cause. The detail is populated
 * only when the triggering descriptor entry is discrete and the tenant still
 * carries the discrete attribute (so we can capture its value at the moment
 * of suspension).
 */
export const certifiedAttributesFailure = (
  descriptorAttributes: Descriptor["attributes"],
  tenantAttributes: TenantAttribute[],
  triggeringAttributeId: AttributeId
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

  const triggeringDescriptorAttribute = descriptorAttributes.certified
    .flat()
    .find((attr) => attr.id === triggeringAttributeId);

  if (
    triggeringDescriptorAttribute &&
    "discreteConfig" in triggeringDescriptorAttribute
  ) {
    const triggeringTenantAttribute = tenantAttributes.find(
      (attr) => attr.id === triggeringAttributeId
    );
    const discreteAttributeFailure: CertifiedDiscreteAttributeFailure | undefined =
      triggeringTenantAttribute?.type === tenantAttributeType.CERTIFIED_DISCRETE
        ? {
            attributeId: triggeringAttributeId,
            tenantValue: triggeringTenantAttribute.discreteValue,
            threshold: triggeringDescriptorAttribute.discreteConfig.threshold,
            comparator: triggeringDescriptorAttribute.discreteConfig.comparator,
          }
        : undefined;
    return {
      suspensionReason: agreementSuspensionReason.certifiedDiscreteAttribute,
      discreteAttributeFailure,
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
