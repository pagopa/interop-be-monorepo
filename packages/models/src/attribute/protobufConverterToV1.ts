import { match } from "ts-pattern";
import { AttributeKindV1, AttributeV1 } from "../gen/v1/attribute/attribute.js";
import { Attribute, AttributeKind, attributeKind } from "./attribute.js";

export const toAttributeV1 = (attribute: Attribute): AttributeV1 => ({
  ...attribute,
  kind: toAttributeKindV1(attribute.kind),
  creationTime: attribute.creationTime.toISOString(),
});

export const toAttributeKindV1 = (input: AttributeKind): AttributeKindV1 =>
  match(input)
    .with(attributeKind.declared, () => AttributeKindV1.DECLARED)
    .with(attributeKind.verified, () => AttributeKindV1.VERIFIED)
    .with(attributeKind.certified, () => AttributeKindV1.CERTIFIED)
    .exhaustive();
