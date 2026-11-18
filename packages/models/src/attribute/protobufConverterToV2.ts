import { match } from "ts-pattern";

import { AttributeKindV2, AttributeV2 } from "../gen/v2/attribute/attribute.js";
import { dateToBigInt } from "../utils.js";
import { Attribute, AttributeKind, attributeKind } from "./attribute.js";

export const toRegistryAttributeV2 = (attribute: Attribute): AttributeV2 => ({
  ...attribute,
  kind: toAttributeKindV2(attribute.kind),
  creationTime: dateToBigInt(attribute.creationTime),
});

export const toAttributeKindV2 = (input: AttributeKind): AttributeKindV2 =>
  match(input)
    .with(attributeKind.certified, () => AttributeKindV2.CERTIFIED)
    .with(attributeKind.declared, () => AttributeKindV2.DECLARED)
    .with(attributeKind.verified, () => AttributeKindV2.VERIFIED)
    .with(
      attributeKind.certifiedDiscrete,
      () => AttributeKindV2.CERTIFIED_DISCRETE
    )
    .exhaustive();
