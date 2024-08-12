import { tenantApi, apiGatewayApi } from "pagopa-interop-api-clients";

export function verifiedAttributeToAttributeValidityState(
  attribute: tenantApi.VerifiedTenantAttribute
): apiGatewayApi.AttributeValidityState {
  return {
    id: attribute.id,
    validity:
      attribute.verifiedBy.length === 0
        ? apiGatewayApi.AttributeValidity.Values.INVALID
        : apiGatewayApi.AttributeValidity.Values.VALID,
  };
}

export function certifiedAttributeToAttributeValidityState(
  attribute: tenantApi.CertifiedTenantAttribute
): apiGatewayApi.AttributeValidityState {
  return {
    id: attribute.id,
    validity:
      attribute.revocationTimestamp === undefined
        ? apiGatewayApi.AttributeValidity.Values.VALID
        : apiGatewayApi.AttributeValidity.Values.INVALID,
  };
}

// eslint-disable-next-line sonarjs/no-identical-functions
export function declaredAttributeToAttributeValidityState(
  attribute: tenantApi.DeclaredTenantAttribute
): apiGatewayApi.AttributeValidityState {
  return {
    id: attribute.id,
    validity:
      attribute.revocationTimestamp === undefined
        ? apiGatewayApi.AttributeValidity.Values.VALID
        : apiGatewayApi.AttributeValidity.Values.INVALID,
  };
}

export function toApiGatewayOrganization(
  tenant: tenantApi.Tenant,
  category: string
): apiGatewayApi.Organization {
  return {
    id: tenant.id,
    externalId: {
      origin: tenant.externalId.origin,
      id: tenant.externalId.value,
    },
    name: tenant.name,
    category,
  };
}
