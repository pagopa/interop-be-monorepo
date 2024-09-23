import {
  agreementApi,
  tenantApi,
  apiGatewayApi,
  attributeRegistryApi,
} from "pagopa-interop-api-clients";
import { isDefined, removeDuplicateObjectsById } from "pagopa-interop-commons";
import {
  verifiedAttributeToAttributeValidityState,
  certifiedAttributeToAttributeValidityState,
  declaredAttributeToAttributeValidityState,
} from "./tenantApiConverter.js";

export function toApiGatewayAgreementAttributes(
  agreement: agreementApi.Agreement,
  tenant: tenantApi.Tenant
): apiGatewayApi.Attributes {
  return {
    verified: removeDuplicateObjectsById(
      agreement.verifiedAttributes.flatMap((attr) =>
        tenant.attributes
          .map((v) => v.verified)
          .filter(isDefined)
          .filter((v) => v.id === attr.id)
          .map(verifiedAttributeToAttributeValidityState)
      )
    ),
    certified: removeDuplicateObjectsById(
      agreement.certifiedAttributes.flatMap((attr) =>
        tenant.attributes
          .map((c) => c.certified)
          .filter(isDefined)
          .filter((c) => c.id === attr.id)
          .map(certifiedAttributeToAttributeValidityState)
      )
    ),
    declared: removeDuplicateObjectsById(
      agreement.declaredAttributes.flatMap((attr) =>
        tenant.attributes
          .map((d) => d.declared)
          .filter(isDefined)
          .filter((d) => d.id === attr.id)
          .map(declaredAttributeToAttributeValidityState)
      )
    ),
  };
}

export function toApiGatewayAttribute(
  attribute: attributeRegistryApi.Attribute
): apiGatewayApi.Attribute {
  return {
    id: attribute.id,
    name: attribute.name,
    kind: attribute.kind,
  };
}
