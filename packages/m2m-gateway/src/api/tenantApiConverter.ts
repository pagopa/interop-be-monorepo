import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";
import { PUBLIC_ADMINISTRATIONS_IDENTIFIER } from "pagopa-interop-models";
import { taxCodeAndIPACodeConflict } from "../model/errors.js";

export function toM2MGatewayApiTenant(
  tenant: tenantApi.Tenant
): m2mGatewayApi.Tenant {
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

export function toGetTenantsApiQueryParams(
  params: m2mGatewayApi.GetTenantsQueryParams
): tenantApi.GetTenantsQueryParams {
  const { IPACode, taxCode } = params;

  if (IPACode && taxCode) {
    throw taxCodeAndIPACodeConflict();
  }

  return {
    externalIdOrigin: IPACode ? PUBLIC_ADMINISTRATIONS_IDENTIFIER : undefined,
    externalIdValue: IPACode ?? taxCode,
    name: undefined,
    features: [],
    offset: params.offset,
    limit: params.limit,
  };
}

export function toM2MGatewayApiTenantCertifiedAttribute(
  tenantCertifiedAttribute: tenantApi.CertifiedTenantAttribute
): m2mGatewayApi.TenantCertifiedAttribute {
  return {
    id: tenantCertifiedAttribute.id,
    assignedAt: tenantCertifiedAttribute.assignmentTimestamp,
    revokedAt: tenantCertifiedAttribute.revocationTimestamp,
  };
}

export function toM2MGatewayApiTenantVerifiedAttribute(
  tenantVerifiedAttribute: tenantApi.VerifiedTenantAttribute
): m2mGatewayApi.TenantVerifiedAttribute {
  return {
    id: tenantVerifiedAttribute.id,
    assignedAt: tenantVerifiedAttribute.assignmentTimestamp,
  };
}

export function toTenantApiVerifiedTenantAttribute(
  seed: m2mGatewayApi.TenantVerifiedAttributeSeed
): tenantApi.VerifiedTenantAttributeSeed {
  return {
    id: seed.id,
    agreementId: seed.agreementId,
    expirationDate: seed.expiresAt,
  };
}
