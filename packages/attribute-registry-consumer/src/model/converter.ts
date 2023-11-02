import {
  AttributeKindV1,
  AttributeV1,
  PersistentAttribute,
  PersistentAttributeKind,
  persistentAttributeKind,
} from "pagopa-interop-models";

export const fromAttributeKind = (
  input: AttributeKindV1
): PersistentAttributeKind => {
  switch (input) {
    case AttributeKindV1.CERTIFIED:
      return persistentAttributeKind.certified;
    case AttributeKindV1.DECLARED:
      return persistentAttributeKind.declared;
    case AttributeKindV1.VERIFIED:
      return persistentAttributeKind.verified;
    case AttributeKindV1.UNSPECIFIED$:
      throw new Error(`Unspecified AttributeKind: ${JSON.stringify(input)}`); // Force exhaustive match
  }
};

export const fromAttributeV1 = (input: AttributeV1): PersistentAttribute => ({
  ...input,
  kind: fromAttributeKind(input.kind),
  creationTime: new Date(Number(input.creationTime)),
});
