import { m2mEventApi } from "pagopa-interop-api-clients";
import { KeyM2MEvent, KeyM2MEventType } from "pagopa-interop-models";
import { match } from "ts-pattern";

function toApiKeyM2MEventType(
  eventType: KeyM2MEventType
): m2mEventApi.KeyM2MEvent["eventType"] {
  return match<KeyM2MEventType, m2mEventApi.KeyM2MEvent["eventType"]>(eventType)
    .with("ClientKeyAdded", () => "CLIENT_KEY_ADDED")
    .with("ClientKeyDeleted", () => "CLIENT_KEY_DELETED")
    .exhaustive();
}

function toApiKeyM2MEvent(event: KeyM2MEvent): m2mEventApi.KeyM2MEvent {
  return {
    id: event.id,
    eventType: toApiKeyM2MEventType(event.eventType),
    eventTimestamp: event.eventTimestamp.toJSON(),
    kid: event.kid,
  };
}

export function toApiKeyM2MEvents(
  events: KeyM2MEvent[]
): m2mEventApi.KeyM2MEvents {
  return {
    events: events.map(toApiKeyM2MEvent),
  };
}
