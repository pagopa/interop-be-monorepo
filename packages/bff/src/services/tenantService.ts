/* eslint-disable functional/immutable-data */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import {
  tenantApi,
  attributeRegistryApi,
  bffApi,
} from "pagopa-interop-api-clients";

export function bffServiceBuilder() {
  return {};
}
export type BffService = ReturnType<typeof bffServiceBuilder>;

export function enhanceTenantAttributes(
  tenantAttributes: tenantApi.TenantAttribute[],
  registryAttributes: attributeRegistryApi.Attribute[]
): bffApi.TenantAttributes {
  const registryAttributesMap: Map<string, bffApi.Attribute> = new Map(
    registryAttributes.map((attribute) => [attribute.id, attribute])
  );

  const declared = tenantAttributes
    .map((attr) => getDeclaredTenantAttribute(attr, registryAttributesMap))
    .filter((x): x is bffApi.DeclaredTenantAttribute => x !== undefined);

  const certified = tenantAttributes
    .map((attr) => getCertifiedTenantAttribute(attr, registryAttributesMap))
    .filter((x): x is bffApi.CertifiedTenantAttribute => x !== undefined);

  const verified = tenantAttributes
    .map((attr) => toApiVerifiedTenantAttribute(attr, registryAttributesMap))
    .filter((x): x is bffApi.VerifiedTenantAttribute => x !== undefined);

  return {
    certified,
    declared,
    verified,
  };
}

export function getDeclaredTenantAttribute(
  attribute: tenantApi.TenantAttribute,
  registryAttributeMap: Map<string, attributeRegistryApi.Attribute>
): bffApi.DeclaredTenantAttribute | undefined {
  if (!attribute.declared) {
    return undefined;
  }
  const registryAttribute = registryAttributeMap.get(attribute.declared.id);
  if (!registryAttribute) {
    return undefined;
  }

  return {
    id: attribute.declared.id,
    name: registryAttribute.name,
    description: registryAttribute.description,
    assignmentTimestamp: attribute.declared.assignmentTimestamp,
    revocationTimestamp: attribute.declared.revocationTimestamp,
  };
}

export function getCertifiedTenantAttribute(
  attribute: tenantApi.TenantAttribute,
  registryAttributeMap: Map<string, attributeRegistryApi.Attribute>
): bffApi.CertifiedTenantAttribute | undefined {
  if (!attribute.certified) {
    return undefined;
  }
  const registryAttribute = registryAttributeMap.get(attribute.certified.id);
  if (!registryAttribute) {
    return undefined;
  }

  return {
    id: attribute.certified.id,
    name: registryAttribute.name,
    description: registryAttribute.description,
    assignmentTimestamp: attribute.certified.assignmentTimestamp,
    revocationTimestamp: attribute.certified.revocationTimestamp,
  };
}

export function toApiVerifiedTenantAttribute(
  attribute: tenantApi.TenantAttribute,
  registryAttributeMap: Map<string, attributeRegistryApi.Attribute>
): bffApi.VerifiedTenantAttribute | undefined {
  if (!attribute.verified) {
    return undefined;
  }
  const registryAttribute = registryAttributeMap.get(attribute.verified.id);
  if (!registryAttribute) {
    return undefined;
  }

  return {
    id: attribute.verified.id,
    name: registryAttribute.name,
    description: registryAttribute.description,
    assignmentTimestamp: attribute.verified.assignmentTimestamp,
    verifiedBy: attribute.verified.verifiedBy,
    revokedBy: attribute.verified.revokedBy,
  };
}
