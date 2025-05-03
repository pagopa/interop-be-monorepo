import { attributeRegistryApi } from "pagopa-interop-api-clients";
import { match } from "ts-pattern";
import {
  ErrorCodes,
  certifiedAttributeNotFound,
  unexpectedAttributeKind,
  unexpectedUndefinedAttributeOriginOrCode,
} from "../../model/errors.js";

export function assertAttributeKindIs<
  K extends attributeRegistryApi.AttributeKind
>(
  attribute: attributeRegistryApi.Attribute,
  expectedKind: K,
  error: Extract<
    ErrorCodes,
    "unexpectedAttributeKind" | "certifiedAttributeNotFound"
  > = "unexpectedAttributeKind"
): asserts attribute is attributeRegistryApi.Attribute & { kind: K } {
  if (attribute.kind !== expectedKind) {
    match(error)
      .with("unexpectedAttributeKind", () => {
        throw unexpectedAttributeKind(attribute);
      })
      .with("certifiedAttributeNotFound", () => {
        throw certifiedAttributeNotFound(attribute);
      })
      .exhaustive();
  }
}

export function assertAttributeOiginAndCodeAreDefined(
  attribute: attributeRegistryApi.Attribute
): asserts attribute is attributeRegistryApi.Attribute & {
  origin: string;
  code: string;
} {
  if (attribute.origin === undefined || attribute.code === undefined) {
    throw unexpectedUndefinedAttributeOriginOrCode(attribute);
  }
}
