import { m2mEventApi, m2mGatewayApi } from "pagopa-interop-api-clients";

export function toM2MGatewayApiAttributeEvent(
  attributeEvent: m2mEventApi.AttributeM2MEvent
): m2mGatewayApi.AttributeEvent {
  return {
    id: attributeEvent.id,
    eventTimestamp: attributeEvent.eventTimestamp,
    eventType: attributeEvent.eventType,
    attributeId: attributeEvent.attributeId,
  };
}

export function toM2MGatewayApiKeyEvent(
  keyEvent: m2mEventApi.KeyM2MEvent
): m2mGatewayApi.KeyEvent {
  return {
    id: keyEvent.id,
    eventTimestamp: keyEvent.eventTimestamp,
    eventType: keyEvent.eventType,
    clientId: keyEvent.clientId,
    kid: keyEvent.kid,
  };
}

export function toM2MGatewayApiClientEvent(
  clientEvent: m2mEventApi.ClientM2MEvent
): m2mGatewayApi.ClientEvent {
  return {
    id: clientEvent.id,
    eventTimestamp: clientEvent.eventTimestamp,
    eventType: clientEvent.eventType,
    clientId: clientEvent.clientId,
  };
}

export function toM2MGatewayApiProducerKeysEvent(
  producerKey: m2mEventApi.ProducerKeyM2MEvent
): m2mGatewayApi.ProducerKeyEvent {
  return {
    id: producerKey.id,
    eventTimestamp: producerKey.eventTimestamp,
    eventType: producerKey.eventType,
    kid: producerKey.kid,
    producerKeychainId: producerKey.producerKeychainId,
  };
}

export function toM2MGatewayApiProducerKeychainsEvent(
  producerKeychainEvent: m2mEventApi.ProducerKeychainM2MEvent
): m2mGatewayApi.ProducerKeychainEvent {
  return {
    id: producerKeychainEvent.id,
    eventTimestamp: producerKeychainEvent.eventTimestamp,
    eventType: producerKeychainEvent.eventType,
    producerKeychainId: producerKeychainEvent.producerKeychainId,
  };
}
