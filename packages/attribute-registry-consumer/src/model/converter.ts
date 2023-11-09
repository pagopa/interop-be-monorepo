import {
  AttributeKindV1,
  AttributeV1,
  AttributeKind,
  attributeKind,
  Attribute,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export const fromAttributeKindV1 = (input: AttributeKindV1): AttributeKind =>
  match(input)
    .with(AttributeKindV1.CERTIFIED, () => attributeKind.certified)
    .with(AttributeKindV1.DECLARED, () => attributeKind.declared)
    .with(AttributeKindV1.VERIFIED, () => attributeKind.verified)
    .otherwise(() => {
      throw new Error(`Invalid AttributeKind: ${JSON.stringify(input)}`); // Force exhaustive match
    });

export const fromAttributeV1 = (input: AttributeV1): Attribute => ({
  ...input,
  kind: fromAttributeKindV1(input.kind),
  creationTime: new Date(Number(input.creationTime)),
});
