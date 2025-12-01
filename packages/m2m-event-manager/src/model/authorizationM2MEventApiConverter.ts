import { m2mEventApi } from "pagopa-interop-api-clients";
import {
  ClientM2MEvent,
  ClientM2MEventType,
  KeyM2MEvent,
  KeyM2MEventType,
  ProducerKeychainM2MEvent,
  ProducerKeychainM2MEventType,
  ProducerKeyM2MEvent,
  ProducerKeyM2MEventType,
} from "pagopa-interop-models";
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
    clientId: event.clientId,
  };
}

export function toApiKeyM2MEvents(
  events: KeyM2MEvent[]
): m2mEventApi.KeyM2MEvents {
  return {
    events: events.map(toApiKeyM2MEvent),
  };
}

function toApiClientM2MEventType(
  eventType: ClientM2MEventType
): m2mEventApi.ClientM2MEvent["eventType"] {
  return match<ClientM2MEventType, m2mEventApi.ClientM2MEvent["eventType"]>(
    eventType
  )
    .with("ClientAdded", () => "CLIENT_ADDED")
    .with("ClientDeleted", () => "CLIENT_DELETED")
    .with("ClientPurposeAdded", () => "CLIENT_PURPOSE_ADDED")
    .with("ClientPurposeRemoved", () => "CLIENT_PURPOSE_REMOVED")
    .exhaustive();
}

function toApiClientM2MEvent(
  event: ClientM2MEvent
): m2mEventApi.ClientM2MEvent {
  return {
    id: event.id,
    eventType: toApiClientM2MEventType(event.eventType),
    eventTimestamp: event.eventTimestamp.toJSON(),
    clientId: event.clientId,
  };
}

export function toApiClientM2MEvents(
  events: ClientM2MEvent[]
): m2mEventApi.ClientM2MEvents {
  return {
    events: events.map(toApiClientM2MEvent),
  };
}

function toApiProducerKeyM2MEventType(
  eventType: ProducerKeyM2MEventType
): m2mEventApi.ProducerKeyM2MEvent["eventType"] {
  return match<
    ProducerKeyM2MEventType,
    m2mEventApi.ProducerKeyM2MEvent["eventType"]
  >(eventType)
    .with("ProducerKeychainKeyAdded", () => "PRODUCER_KEYCHAIN_KEY_ADDED")
    .with("ProducerKeychainKeyDeleted", () => "PRODUCER_KEYCHAIN_KEY_DELETED")
    .exhaustive();
}

function toApiProducerKeyM2MEvent(
  event: ProducerKeyM2MEvent
): m2mEventApi.ProducerKeyM2MEvent {
  return {
    id: event.id,
    eventType: toApiProducerKeyM2MEventType(event.eventType),
    eventTimestamp: event.eventTimestamp.toJSON(),
    kid: event.kid,
    producerKeychainId: event.producerKeychainId,
  };
}

export function toApiProducerKeyM2MEvents(
  events: ProducerKeyM2MEvent[]
): m2mEventApi.ProducerKeyM2MEvents {
  return {
    events: events.map(toApiProducerKeyM2MEvent),
  };
}

function toApiProducerKeychainM2MEventType(
  eventType: ProducerKeychainM2MEventType
): m2mEventApi.ProducerKeychainM2MEvent["eventType"] {
  return match<
    ProducerKeychainM2MEventType,
    m2mEventApi.ProducerKeychainM2MEvent["eventType"]
  >(eventType)
    .with("ProducerKeychainAdded", () => "PRODUCER_KEYCHAIN_ADDED")
    .with("ProducerKeychainDeleted", () => "PRODUCER_KEYCHAIN_DELETED")
    .with(
      "ProducerKeychainEServiceAdded",
      () => "PRODUCER_KEYCHAIN_ESERVICE_ADDED"
    )
    .with(
      "ProducerKeychainEServiceRemoved",
      () => "PRODUCER_KEYCHAIN_ESERVICE_REMOVED"
    )
    .exhaustive();
}

function toApiProducerKeychainM2MEvent(
  event: ProducerKeychainM2MEvent
): m2mEventApi.ProducerKeychainM2MEvent {
  return {
    id: event.id,
    eventType: toApiProducerKeychainM2MEventType(event.eventType),
    eventTimestamp: event.eventTimestamp.toJSON(),
    producerKeychainId: event.producerKeychainId,
  };
}

export function toApiProducerKeychainM2MEvents(
  events: ProducerKeychainM2MEvent[]
): m2mEventApi.ProducerKeychainM2MEvents {
  return {
    events: events.map(toApiProducerKeychainM2MEvent),
  };
}
