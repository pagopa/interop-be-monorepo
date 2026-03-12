import { attributeRegistryApi } from "pagopa-interop-api-clients";
import {
  unexpectedAttributeKind,
  unexpectedUndefinedAttributeOriginOrCode,
} from "../../model/errors.js";

export function assertAttributeKindIs<
  K extends attributeRegistryApi.AttributeKind,
>(
  attribute: attributeRegistryApi.Attribute,
  expectedKind: K
): asserts attribute is attributeRegistryApi.Attribute & { kind: K } {
  if (attribute.kind !== expectedKind) {
    throw unexpectedAttributeKind(attribute);
  }
}

export function assertAttributeOriginAndCodeAreDefined(
  attribute: attributeRegistryApi.Attribute
): asserts attribute is attributeRegistryApi.Attribute & {
  origin: string;
  code: string;
} {
  if (attribute.origin === undefined || attribute.code === undefined) {
    throw unexpectedUndefinedAttributeOriginOrCode(attribute);
  }
}
