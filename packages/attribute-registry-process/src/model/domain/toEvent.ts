import { CreateEvent } from "pagopa-interop-commons";
import {
  AttributeEvent,
  Attribute,
  toAttributeV1,
} from "pagopa-interop-models";

export const toCreateEventAttributeAdded = (
  attribute: Attribute,
  correlationId: string
): CreateEvent<AttributeEvent> => ({
  streamId: attribute.id,
  version: 0,
  event: {
    type: "AttributeAdded",
    event_version: 1,
    data: { attribute: toAttributeV1(attribute) },
  },
  correlationId,
});
