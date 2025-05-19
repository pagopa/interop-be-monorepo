import {
  attributeRegistryApi,
  m2mGatewayApi,
  tenantApi,
} from "pagopa-interop-api-clients";
import { PUBLIC_ADMINISTRATIONS_IDENTIFIER } from "pagopa-interop-models";
import {
  assertAttributeKindIs,
  assertAttributeOriginAndCodeAreDefined,
} from "../utils/validators/attributeValidators.js";
import { tenantQueryConflictError } from "../model/errors.js";

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
    throw tenantQueryConflictError();
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
  tenantCertifiedAttribute: tenantApi.CertifiedTenantAttribute,
  certifiedAttribute: attributeRegistryApi.Attribute
): m2mGatewayApi.TenantCertifiedAttribute {
  assertAttributeKindIs(
    certifiedAttribute,
    attributeRegistryApi.AttributeKind.Values.CERTIFIED
  );
  assertAttributeOriginAndCodeAreDefined(certifiedAttribute);

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
