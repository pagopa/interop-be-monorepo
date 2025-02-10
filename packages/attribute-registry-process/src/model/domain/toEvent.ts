import { CreateEvent } from "pagopa-interop-commons";
import {
  AttributeEvent,
  Attribute,
  toAttributeV1,
  CorrelationId,
} from "pagopa-interop-models";

export const toCreateEventAttributeAdded = (
  attribute: Attribute,
  correlationId: CorrelationId
): CreateEvent<AttributeEvent> => ({
  streamId: attribute.id,
  version: undefined,
  event: {
    type: "AttributeAdded",
    event_version: 1,
    data: { attribute: toAttributeV1(attribute) },
  },
  correlationId,
});
