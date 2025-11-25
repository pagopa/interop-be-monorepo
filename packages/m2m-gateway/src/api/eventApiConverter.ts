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
