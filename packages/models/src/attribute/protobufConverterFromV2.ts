import { unsafeBrandId } from "../brandedIds.js";
import { AttributeKindV2, AttributeV2 } from "../gen/v2/attribute/attribute.js";
import { bigIntToDate } from "../utils.js";
import { Attribute, AttributeKind, attributeKind } from "./attribute.js";

export const fromAttributeKindV2 = (input: AttributeKindV2): AttributeKind => {
  switch (input) {
    case AttributeKindV2.CERTIFIED:
      return attributeKind.certified;
    case AttributeKindV2.DECLARED:
      return attributeKind.declared;
    case AttributeKindV2.VERIFIED:
      return attributeKind.verified;
    case AttributeKindV2.CERTIFIED_DISCRETE:
      return attributeKind.certifiedDiscrete;
  }
};

export const fromRegistryAttributeV2 = (input: AttributeV2): Attribute => ({
  ...input,
  id: unsafeBrandId(input.id),
  kind: fromAttributeKindV2(input.kind),
  creationTime: bigIntToDate(input.creationTime),
});
