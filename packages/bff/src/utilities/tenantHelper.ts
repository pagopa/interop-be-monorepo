import {
  tenantApi,
  attributeRegistryApi,
  bffApi,
} from "pagopa-interop-api-clients";

export function enhanceTenantAttributes(
  tenantAttributes: tenantApi.TenantAttribute[],
  registryAttributes: attributeRegistryApi.Attribute[]
): bffApi.TenantAttributes {
  const registryAttributesMap: Map<string, bffApi.Attribute> = new Map(
    registryAttributes.map((attribute) => [attribute.id, attribute])
  );

  const declared = tenantAttributes
    .map((attr) => toApiDeclaredTenantAttribute(attr, registryAttributesMap))
    .filter((x): x is bffApi.DeclaredTenantAttribute => x !== null);

  const certified = tenantAttributes
    .map((attr) => toApiCertifiedTenantAttribute(attr, registryAttributesMap))
    .filter((x): x is bffApi.CertifiedTenantAttribute => x !== null);

  const verified = tenantAttributes
    .map((attr) => toApiVerifiedTenantAttribute(attr, registryAttributesMap))
    .filter((x): x is bffApi.VerifiedTenantAttribute => x !== null);

  return {
    certified,
    declared,
    verified,
  };
}

export function toApiDeclaredTenantAttribute(
  attribute: tenantApi.TenantAttribute,
  registryAttributeMap: Map<string, attributeRegistryApi.Attribute>
): bffApi.DeclaredTenantAttribute | null {
  if (!attribute.declared) {
    return null;
  }
  const registryAttribute = registryAttributeMap.get(attribute.declared.id);
  if (!registryAttribute) {
    return null;
  }

  return {
    id: attribute.declared.id,
    name: registryAttribute.name,
    description: registryAttribute.description,
    assignmentTimestamp: attribute.declared.assignmentTimestamp,
    revocationTimestamp: attribute.declared.revocationTimestamp,
  };
}

export function toApiCertifiedTenantAttribute(
  attribute: tenantApi.TenantAttribute,
  registryAttributeMap: Map<string, attributeRegistryApi.Attribute>
): bffApi.CertifiedTenantAttribute | null {
  if (!attribute.certified) {
    return null;
  }
  const registryAttribute = registryAttributeMap.get(attribute.certified.id);
  if (!registryAttribute) {
    return null;
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
): bffApi.VerifiedTenantAttribute | null {
  if (!attribute.verified) {
    return null;
  }
  const registryAttribute = registryAttributeMap.get(attribute.verified.id);
  if (!registryAttribute) {
    return null;
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
