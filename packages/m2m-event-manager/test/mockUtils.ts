import { randomInt } from "crypto";
import {
  AgreementId,
  AgreementM2MEvent,
  AgreementM2MEventId,
  AttributeId,
  AttributeM2MEvent,
  AttributeM2MEventId,
  ConsumerDelegationM2MEvent,
  DelegationId,
  DelegationM2MEventId,
  DescriptorId,
  EServiceId,
  EServiceM2MEvent,
  EServiceM2MEventId,
  PurposeId,
  PurposeM2MEvent,
  PurposeM2MEventId,
  PurposeVersionId,
  ProducerDelegationM2MEvent,
  KeyM2MEvent,
  KeyM2MEventId,
  TenantId,
  UserId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";

import { v7 as uuidv7 } from "uuid";

export function generateM2MEventId<
  ID extends
    | AttributeM2MEventId
    | EServiceM2MEventId
    | AgreementM2MEventId
    | PurposeM2MEventId
    | AttributeM2MEventId
    | EServiceM2MEventId
    | AgreementM2MEventId
    | DelegationM2MEventId
    | KeyM2MEventId
>(): ID {
  return unsafeBrandId<ID>(uuidv7());
}

export function getMockedAttributeM2MEvent(eventType: AttributeM2MEvent["eventType"]): AttributeM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp: new Date(),
    resourceVersion: randomInt(1, 1000),
    attributeId: generateId<AttributeId>(),
  };
}

export function getMockedEServiceM2MEvent({
  eventType,
  visibility,
  producerId,
  producerDelegateId,
  producerDelegationId,
}: {
  eventType: EServiceM2MEvent["eventType"];
  visibility: EServiceM2MEvent["visibility"];
  producerId?: TenantId;
  producerDelegateId?: TenantId;
  producerDelegationId?: DelegationId;
}): EServiceM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp: new Date(),
    resourceVersion: randomInt(1, 1000),
    eserviceId: generateId<EServiceId>(),
    descriptorId: generateId<DescriptorId>(),
    visibility,
    producerId: producerId ?? generateId<TenantId>(),
    producerDelegateId: producerDelegateId ?? generateId<TenantId>(),
    producerDelegationId: producerDelegationId ?? generateId<DelegationId>(),
  };
}

export function getMockedAgreementM2MEvent({
  eventType,
  visibility,
  consumerId,
  producerId,
  consumerDelegateId,
  consumerDelegationId,
  producerDelegateId,
  producerDelegationId,
}: {
  eventType: AgreementM2MEvent["eventType"];
  visibility: AgreementM2MEvent["visibility"];
  consumerId?: TenantId;
  consumerDelegateId?: TenantId;
  consumerDelegationId?: DelegationId;
  producerId?: TenantId;
  producerDelegateId?: TenantId;
  producerDelegationId?: DelegationId;
}): AgreementM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp: new Date(),
    resourceVersion: randomInt(1, 1000),
    agreementId: generateId<AgreementId>(),
    visibility,
    consumerId: consumerId ?? generateId<TenantId>(),
    consumerDelegateId: consumerDelegateId ?? generateId<TenantId>(),
    consumerDelegationId: consumerDelegationId ?? generateId<DelegationId>(),
    producerId: producerId ?? generateId<TenantId>(),
    producerDelegateId: producerDelegateId ?? generateId<TenantId>(),
    producerDelegationId: producerDelegationId ?? generateId<DelegationId>(),
  };
}

export function getMockedPurposeM2MEvent({
  eventType,
  visibility,
  consumerId,
  producerId,
  consumerDelegateId,
  consumerDelegationId,
  producerDelegateId,
  producerDelegationId,
  purposeVersionId,
}: {
  eventType: PurposeM2MEvent["eventType"];
  visibility: PurposeM2MEvent["visibility"];
  consumerId?: TenantId;
  consumerDelegateId?: TenantId;
  consumerDelegationId?: DelegationId;
  producerId?: TenantId;
  producerDelegateId?: TenantId;
  producerDelegationId?: DelegationId;
  purposeVersionId?: PurposeVersionId;
}): PurposeM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp: new Date(),
    resourceVersion: randomInt(1, 1000),
    purposeId: generateId<PurposeId>(),
    purposeVersionId: purposeVersionId ?? generateId<PurposeVersionId>(),
    visibility,
    consumerId: consumerId ?? generateId<TenantId>(),
    consumerDelegateId: consumerDelegateId ?? generateId<TenantId>(),
    consumerDelegationId: consumerDelegationId ?? generateId<DelegationId>(),
    producerId: producerId ?? generateId<TenantId>(),
    producerDelegateId: producerDelegateId ?? generateId<TenantId>(),
    producerDelegationId: producerDelegationId ?? generateId<DelegationId>(),
  };
}

export function getMockedProducerDelegationM2MEvent(
  eventType: ProducerDelegationM2MEvent["eventType"]
): ProducerDelegationM2MEvent {
  return getMockedDelegationM2MEvent(eventType) as ProducerDelegationM2MEvent;
}

export function getMockedConsumerDelegationM2MEvent(
  eventType: ConsumerDelegationM2MEvent["eventType"]
): ConsumerDelegationM2MEvent {
  return getMockedDelegationM2MEvent(eventType) as ConsumerDelegationM2MEvent;
}

function getMockedDelegationM2MEvent(
  eventType: ConsumerDelegationM2MEvent["eventType"] | ProducerDelegationM2MEvent["eventType"]
): ConsumerDelegationM2MEvent | ProducerDelegationM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp: new Date(),
    resourceVersion: randomInt(1, 1000),
    delegationId: generateId<DelegationId>(),
  };
}

export function getMockedKeyM2MEvent(eventType: KeyM2MEvent["eventType"]): KeyM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp: new Date(),
    resourceVersion: randomInt(1, 1000),
    kid: generateId(),
    clientId: generateId(),
  };
}
