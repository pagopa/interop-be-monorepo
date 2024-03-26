import { match } from "ts-pattern";
import { AttributeKindV1, AttributeV1 } from "../index.js";
import { Attribute, AttributeKind } from "./attribute.js";

export const toAttributeV1 = (attribute: Attribute): AttributeV1 => ({
  ...attribute,
  kind: toAttributeKindV1(attribute.kind),
  creationTime: attribute.creationTime.toISOString(),
});

export const toAttributeKindV1 = (input: AttributeKind): AttributeKindV1 =>
  match(input)
    .with("Declared", () => AttributeKindV1.DECLARED)
    .with("Verified", () => AttributeKindV1.VERIFIED)
    .with("Certified", () => AttributeKindV1.CERTIFIED)
    .exhaustive();
