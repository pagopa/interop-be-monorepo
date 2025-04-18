import {
  attributeRegistryApi,
  m2mGatewayApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { genericError } from "pagopa-interop-models";

export function toM2MTenant(tenant: tenantApi.Tenant): m2mGatewayApi.Tenant {
  return {
    id: tenant.id,
    externalId: tenant.externalId,
    createdAt: tenant.createdAt,
    updatedAt: tenant.updatedAt,
    name: tenant.name,
    kind: tenant.kind,
    onboardedAt: tenant.onboardedAt,
    subUnitType: tenant.subUnitType,
  };
}

export function toM2MTenantCertifiedAttribute(
  tenantCertifiedAttribute: tenantApi.CertifiedTenantAttribute,
  certifiedAttribute: attributeRegistryApi.Attribute
): m2mGatewayApi.TenantCertifiedAttribute {
  if (!certifiedAttribute.origin || !certifiedAttribute.code) {
    throw genericError("Invalid certified attribute");
  }

  return {
    id: certifiedAttribute.id,
    description: certifiedAttribute.description,
    name: certifiedAttribute.name,
    code: certifiedAttribute.code,
    origin: certifiedAttribute.origin,
    assignedAt: tenantCertifiedAttribute.assignmentTimestamp,
    revokedAt: tenantCertifiedAttribute.revocationTimestamp,
  };
}
