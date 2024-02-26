import { CreateEvent } from "pagopa-interop-commons";
import {
  AttributeEvent,
  AttributeKind,
  AttributeKindV1,
  Attribute,
  AttributeV1,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

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

export const toCreateEventAttributeAdded = (
  attribute: Attribute
): CreateEvent<AttributeEvent> => ({
  streamId: attribute.id,
  version: 0,
  event: {
    type: "AttributeAdded",
    event_version: 1,
    data: { attribute: toAttributeV1(attribute) },
  },
});
