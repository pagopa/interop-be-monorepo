import {
  attributeRegistryApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { ApiError } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import {
  assertAttributeKindIs,
  assertAttributeOriginAndCodeAreDefined,
} from "../utils/validators/attributeValidators.js";
import { attributeNotFound } from "../model/errors.js";

export function toM2MGatewayApiCertifiedAttribute({
  attribute,
  logger,
  mapThrownErrorsToNotFound = false,
}: {
  attribute: attributeRegistryApi.Attribute;
  logger: Logger;
  mapThrownErrorsToNotFound?: boolean;
}): m2mGatewayApi.CertifiedAttribute {
  try {
    assertAttributeKindIs(
      attribute,
      attributeRegistryApi.AttributeKind.Values.CERTIFIED
    );
    assertAttributeOriginAndCodeAreDefined(attribute);

    return {
      id: attribute.id,
      code: attribute.code,
      description: attribute.description,
      origin: attribute.origin,
      name: attribute.name,
      createdAt: attribute.creationTime,
    };
  } catch (error) {
    if (mapThrownErrorsToNotFound) {
      logger.warn(
        `Root cause for "Attribute not found" error: unexpected error while converting attribute: ${
          error instanceof ApiError ? error.detail : error
        }`
      );
      throw attributeNotFound(attribute);
    } else {
      throw error;
    }
  }
}

export function toM2MGatewayApiVerifiedAttribute({
  attribute,
  logger,
  mapThrownErrorsToNotFound = false,
}: {
  attribute: attributeRegistryApi.Attribute;
  logger: Logger;
  mapThrownErrorsToNotFound?: boolean;
}): m2mGatewayApi.VerifiedAttribute {
  try {
    assertAttributeKindIs(
      attribute,
      attributeRegistryApi.AttributeKind.Values.VERIFIED
    );

    return {
      id: attribute.id,
      description: attribute.description,
      name: attribute.name,
      createdAt: attribute.creationTime,
    };
  } catch (error) {
    if (mapThrownErrorsToNotFound) {
      logger.warn(
        `Root cause for "Attribute not found" error: unexpected error while converting attribute: ${
          error instanceof ApiError ? error.detail : error
        }`
      );
      throw attributeNotFound(attribute);
    } else {
      throw error;
    }
  }
}
