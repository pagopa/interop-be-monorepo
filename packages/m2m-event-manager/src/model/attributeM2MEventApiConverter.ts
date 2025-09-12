import { m2mEventApi } from "pagopa-interop-api-clients";
import { AttributeM2MEvent } from "pagopa-interop-models";

function toApiAttributeM2MEvent(
  event: AttributeM2MEvent
): m2mEventApi.AttributeM2MEvent {
  return {
    id: event.id,
    eventType: event.eventType, // TODO event type enum in API spec?
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
