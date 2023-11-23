import {
  AttributeKindV1,
  AttributeV1,
  AttributeKind,
  attributeKind,
  Attribute,
} from "pagopa-interop-models";

export const fromAttributeKindV1 = (input: AttributeKindV1): AttributeKind => {
  switch (input) {
    case AttributeKindV1.CERTIFIED:
      return attributeKind.certified;
    case AttributeKindV1.DECLARED:
      return attributeKind.declared;
    case AttributeKindV1.VERIFIED:
      return attributeKind.verified;
    case AttributeKindV1.UNSPECIFIED$:
      throw new Error("Unspecified attribute kind");
  }
};
export const fromAttributeV1 = (input: AttributeV1): Attribute => ({
  ...input,
  kind: fromAttributeKindV1(input.kind),
  creationTime: new Date(Number(input.creationTime)),
});
