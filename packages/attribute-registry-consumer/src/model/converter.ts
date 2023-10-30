import {
  AttributeKindV1,
  AttributeV1,
  PersistentAttribute,
  PersistentAttributeKind,
  persistentAttributeKind,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export const fromAttributeKind = (
  input: AttributeKindV1
): PersistentAttributeKind =>
  match(input)
    .with(AttributeKindV1.CERTIFIED, () => persistentAttributeKind.certified)
    .with(AttributeKindV1.DECLARED, () => persistentAttributeKind.declared)
    .with(AttributeKindV1.VERIFIED, () => persistentAttributeKind.verified)
    .otherwise(() => {
      throw new Error(`Invalid AttributeKind: ${JSON.stringify(input)}`); // Force exhaustive match
    });

export const fromAttributeV1 = (input: AttributeV1): PersistentAttribute => ({
  ...input,
  kind: fromAttributeKind(input.kind),
  creationTime: new Date(Number(input.creationTime)),
});
