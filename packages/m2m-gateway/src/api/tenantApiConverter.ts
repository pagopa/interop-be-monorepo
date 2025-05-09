import { m2mGatewayApi, tenantApi } from "pagopa-interop-api-clients";

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
  return {
    externalIdOrigin: params.externalIdOrigin,
    externalIdValue: params.externalIdValue,
    name: undefined,
    features: [],
    offset: params.offset,
    limit: params.limit,
  };
}
