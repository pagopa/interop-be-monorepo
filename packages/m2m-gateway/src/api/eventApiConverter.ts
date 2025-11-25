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
