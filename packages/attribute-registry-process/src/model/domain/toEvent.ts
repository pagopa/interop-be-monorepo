import { CreateEvent } from "pagopa-interop-commons";
import {
  AttributeEvent,
  AttributeKind,
  AttributeKindV1,
  AttributeTmp,
  AttributeV1,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export const toAttributeV1 = (attribute: AttributeTmp): AttributeV1 => ({
  ...attribute,
  kind: toAttributeKindV1(attribute.kind),
  creationTime: String(attribute.creationTime.getTime()),
});

export const toAttributeKindV1 = (input: AttributeKind): AttributeKindV1 =>
  match(input)
    .with("Declared", () => AttributeKindV1.DECLARED)
    .with("Verified", () => AttributeKindV1.VERIFIED)
    .with("Certified", () => AttributeKindV1.CERTIFIED)
    .exhaustive();

export const toCreateEventAttributeAdded = (
  attribute: AttributeTmp
): CreateEvent<AttributeEvent> => ({
  streamId: attribute.id,
  version: 0,
  event: {
    type: "AttributeAdded",
    data: { attribute: toAttributeV1(attribute) },
  },
});
