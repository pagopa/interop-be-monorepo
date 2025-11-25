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

export function toM2MGatewayApiProducerDelegationEvent(
  producerDelegationEvent: m2mEventApi.ProducerDelegationM2MEvent
): m2mGatewayApi.ProducerDelegationEvent {
  return {
    id: producerDelegationEvent.id,
    eventTimestamp: producerDelegationEvent.eventTimestamp,
    eventType: producerDelegationEvent.eventType,
    delegationId: producerDelegationEvent.delegationId,
  };
}

export function toM2MGatewayApiConsumerDelegationEvent(
  consumerDelegationEvent: m2mEventApi.ConsumerDelegationM2MEvent
): m2mGatewayApi.ConsumerDelegationEvent {
  return {
    id: consumerDelegationEvent.id,
    eventTimestamp: consumerDelegationEvent.eventTimestamp,
    eventType: consumerDelegationEvent.eventType,
    delegationId: consumerDelegationEvent.delegationId,
  };
}
export function toM2MGatewayApiEServiceTemplateEvent(
  eserviceTemplateEvent: m2mEventApi.EServiceTemplateM2MEvent
): m2mGatewayApi.EServiceTemplateEvent {
  return {
    id: eserviceTemplateEvent.id,
    eventTimestamp: eserviceTemplateEvent.eventTimestamp,
    eventType: eserviceTemplateEvent.eventType,
    eserviceTemplateId: eserviceTemplateEvent.eserviceTemplateId,
    eserviceTemplateVersionId: eserviceTemplateEvent.eserviceTemplateVersionId,
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

export function toM2MGatewayApiEServiceEvent(
  eserviceEvent: m2mEventApi.EServiceM2MEvent
): m2mGatewayApi.EServiceEvent {
  return {
    id: eserviceEvent.id,
    eserviceId: eserviceEvent.eserviceId,
    eventType: eserviceEvent.eventType,
    eventTimestamp: eserviceEvent.eventTimestamp,
    descriptorId: eserviceEvent.descriptorId,
    producerDelegationId: eserviceEvent.producerDelegationId,
  };
}

export function toM2MGatewayApiAgreementEvent(
  agreementEvent: m2mEventApi.AgreementM2MEvent
): m2mGatewayApi.AgreementEvent {
  return {
    id: agreementEvent.id,
    agreementId: agreementEvent.agreementId,
    eventType: agreementEvent.eventType,
    eventTimestamp: agreementEvent.eventTimestamp,
    producerDelegationId: agreementEvent.producerDelegationId,
    consumerDelegationId: agreementEvent.consumerDelegationId,
  };
}

export function toM2MGatewayApiTenantEvent(
  tenantEvent: m2mEventApi.TenantM2MEvent
): m2mGatewayApi.TenantEvent {
  return {
    id: tenantEvent.id,
    tenantId: tenantEvent.tenantId,
    eventType: tenantEvent.eventType,
    eventTimestamp: tenantEvent.eventTimestamp,
  };
}
