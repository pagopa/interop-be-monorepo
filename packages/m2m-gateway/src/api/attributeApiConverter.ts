import {
  attributeRegistryApi,
  m2mGatewayApi,
} from "pagopa-interop-api-clients";
import { ApiError } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  assertAttributeKindIs,
  assertAttributeOriginAndCodeAreDefined,
} from "../utils/validators/attributeValidators.js";
import { attributeNotFound } from "../model/errors.js";

function convertAttribute(
  attribute: attributeRegistryApi.Attribute,
  attributeKind: typeof attributeRegistryApi.AttributeKind.Values.CERTIFIED,
  logger: Logger,
  mapThrownErrorsToNotFound?: boolean
): m2mGatewayApi.CertifiedAttribute;

function convertAttribute(
  attribute: attributeRegistryApi.Attribute,
  attributeKind: typeof attributeRegistryApi.AttributeKind.Values.DECLARED,
  logger: Logger,
  mapThrownErrorsToNotFound?: boolean
): m2mGatewayApi.DeclaredAttribute;

function convertAttribute(
  attribute: attributeRegistryApi.Attribute,
  attributeKind: typeof attributeRegistryApi.AttributeKind.Values.VERIFIED,
  logger: Logger,
  mapThrownErrorsToNotFound?: boolean
): m2mGatewayApi.VerifiedAttribute;

function convertAttribute(
  attribute: attributeRegistryApi.Attribute,
  attributeKind: attributeRegistryApi.AttributeKind,
  logger: Logger,
  mapThrownErrorsToNotFound = false
):
  | m2mGatewayApi.CertifiedAttribute
  | m2mGatewayApi.DeclaredAttribute
  | m2mGatewayApi.VerifiedAttribute {
  try {
    assertAttributeKindIs(attribute, attributeKind);

    const baseFields = {
      id: attribute.id,
      description: attribute.description,
      name: attribute.name,
      createdAt: attribute.creationTime,
    };
    return match(attributeKind)
      .with(attributeRegistryApi.AttributeKind.Values.CERTIFIED, () => {
        assertAttributeOriginAndCodeAreDefined(attribute);
        return {
          ...baseFields,
          code: attribute.code,
          origin: attribute.origin,
        };
      })
      .with(
        attributeRegistryApi.AttributeKind.Values.DECLARED,
        attributeRegistryApi.AttributeKind.Values.VERIFIED,
        () => baseFields
      )
      .exhaustive();
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

export function toM2MGatewayApiCertifiedAttribute({
  attribute,
  logger,
  mapThrownErrorsToNotFound = false,
}: {
  attribute: attributeRegistryApi.Attribute;
  logger: Logger;
  mapThrownErrorsToNotFound?: boolean;
}): m2mGatewayApi.CertifiedAttribute {
  return convertAttribute(
    attribute,
    attributeRegistryApi.AttributeKind.Values.CERTIFIED,
    logger,
    mapThrownErrorsToNotFound
  );
}

export function toM2MGatewayApiDeclaredAttribute({
  attribute,
  logger,
  mapThrownErrorsToNotFound = false,
}: {
  attribute: attributeRegistryApi.Attribute;
  logger: Logger;
  mapThrownErrorsToNotFound?: boolean;
}): m2mGatewayApi.DeclaredAttribute {
  return convertAttribute(
    attribute,
    attributeRegistryApi.AttributeKind.Values.DECLARED,
    logger,
    mapThrownErrorsToNotFound
  );
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
  return convertAttribute(
    attribute,
    attributeRegistryApi.AttributeKind.Values.VERIFIED,
    logger,
    mapThrownErrorsToNotFound
  );
}
