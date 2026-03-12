import { m2mEventApi } from "pagopa-interop-api-clients";
import {
  AttributeM2MEvent,
  AttributeM2MEventType,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

function toApiAttributeM2MEventType(
  eventType: AttributeM2MEventType
): m2mEventApi.AttributeM2MEvent["eventType"] {
  return match<
    AttributeM2MEventType,
    m2mEventApi.AttributeM2MEvent["eventType"]
  >(eventType)
    .with("AttributeAdded", () => "ATTRIBUTE_ADDED")
    .exhaustive();
}

function toApiAttributeM2MEvent(
  event: AttributeM2MEvent
): m2mEventApi.AttributeM2MEvent {
  return {
    id: event.id,
    eventType: toApiAttributeM2MEventType(event.eventType),
    eventTimestamp: event.eventTimestamp.toJSON(),
    attributeId: event.attributeId,
  };
}

export function toApiAttributeM2MEvents(
  events: AttributeM2MEvent[]
): m2mEventApi.AttributeM2MEvents {
  return {
    events: events.map(toApiAttributeM2MEvent),
  };
}
