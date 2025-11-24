/* eslint-disable sonarjs/no-identical-functions */
import { m2mEventApi } from "pagopa-interop-api-clients";
import {
  ConsumerDelegationM2MEvent,
  ConsumerDelegationM2MEventType,
  ProducerDelegationM2MEvent,
  ProducerDelegationM2MEventType,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

export function toApiConsumerDelegationM2MEventType(
  event: ConsumerDelegationM2MEventType
): m2mEventApi.ConsumerDelegationM2MEvent["eventType"] {
  return match<
    ConsumerDelegationM2MEventType,
    m2mEventApi.ConsumerDelegationM2MEvent["eventType"]
  >(event)
    .with("ConsumerDelegationApproved", () => "CONSUMER_DELEGATION_APPROVED")
    .with("ConsumerDelegationRejected", () => "CONSUMER_DELEGATION_REJECTED")
    .with("ConsumerDelegationRevoked", () => "CONSUMER_DELEGATION_REVOKED")
    .with("ConsumerDelegationSubmitted", () => "CONSUMER_DELEGATION_SUBMITTED")
    .with(
      "DelegationSignedContractGenerated",
      () => "DELEGATION_CONTRACT_GENERATED"
    )
    .exhaustive();
}

export function toApiProducerDelegationM2MEventType(
  event: ProducerDelegationM2MEventType
): m2mEventApi.ProducerDelegationM2MEvent["eventType"] {
  return match<
    ProducerDelegationM2MEventType,
    m2mEventApi.ProducerDelegationM2MEvent["eventType"]
  >(event)
    .with("ProducerDelegationApproved", () => "PRODUCER_DELEGATION_APPROVED")
    .with("ProducerDelegationRejected", () => "PRODUCER_DELEGATION_REJECTED")
    .with("ProducerDelegationRevoked", () => "PRODUCER_DELEGATION_REVOKED")
    .with("ProducerDelegationSubmitted", () => "PRODUCER_DELEGATION_SUBMITTED")
    .with(
      "DelegationSignedContractGenerated",
      () => "DELEGATION_CONTRACT_GENERATED"
    )
    .exhaustive();
}

function toApiConsumerDelegationM2MEvent(
  event: ConsumerDelegationM2MEvent
): m2mEventApi.ConsumerDelegationM2MEvent {
  return {
    id: event.id,
    eventType: toApiConsumerDelegationM2MEventType(event.eventType),
    eventTimestamp: event.eventTimestamp.toJSON(),
    delegationId: event.delegationId,
  };
}

function toApiProducerDelegationM2MEvent(
  event: ProducerDelegationM2MEvent
): m2mEventApi.ProducerDelegationM2MEvent {
  return {
    id: event.id,
    eventType: toApiProducerDelegationM2MEventType(event.eventType),
    eventTimestamp: event.eventTimestamp.toJSON(),
    delegationId: event.delegationId,
  };
}

export function toApiConsumerDelegationM2MEvents(
  events: ConsumerDelegationM2MEvent[]
): m2mEventApi.ConsumerDelegationM2MEvents {
  return {
    events: events.map(toApiConsumerDelegationM2MEvent),
  };
}

export function toApiProducerDelegationM2MEvents(
  events: ProducerDelegationM2MEvent[]
): m2mEventApi.ProducerDelegationM2MEvents {
  return {
    events: events.map(toApiProducerDelegationM2MEvent),
  };
}
