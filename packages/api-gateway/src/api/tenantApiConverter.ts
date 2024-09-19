import {
  tenantApi,
  apiGatewayApi,
  attributeRegistryApi,
} from "pagopa-interop-api-clients";

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

function toApiGatewayOrganizationCategory(
  attributes: attributeRegistryApi.Attribute[]
): apiGatewayApi.Organization["category"] {
  const categoryIpaAttribute = attributes.find((a) => a.origin === "IPA");
  return categoryIpaAttribute ? categoryIpaAttribute.name : "Unknown";
}

export function toApiGatewayOrganization(
  tenant: tenantApi.Tenant,
  tenantAttributes: attributeRegistryApi.Attribute[]
): apiGatewayApi.Organization {
  return {
    id: tenant.id,
    externalId: {
      origin: tenant.externalId.origin,
      id: tenant.externalId.value,
    },
    name: tenant.name,
    category: toApiGatewayOrganizationCategory(tenantAttributes),
  };
}
