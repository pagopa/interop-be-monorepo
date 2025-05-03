import {
  attributeRegistryApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import {
  assertAttributeKindIs,
  assertAttributeOiginAndCodeAreDefined,
} from "../utils/validators/attributeValidators.js";

export function toM2MGatewayApiCertifiedAttribute(
  attribute: attributeRegistryApi.Attribute,
  errorType: Parameters<
    typeof assertAttributeKindIs
  >[2] = "unexpectedAttributeKind"
): m2mGatewayApi.CertifiedAttribute {
  assertAttributeKindIs(
    attribute,
    attributeRegistryApi.AttributeKind.Values.CERTIFIED,
    errorType
  );
  assertAttributeOiginAndCodeAreDefined(attribute);

  return {
    id: attribute.id,
    code: attribute.code,
    description: attribute.description,
    origin: attribute.origin,
    name: attribute.name,
    createdAt: attribute.creationTime,
  };
}
