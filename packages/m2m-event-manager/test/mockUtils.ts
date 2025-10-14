import {
  AgreementId,
  AgreementM2MEvent,
  AgreementM2MEventId,
  AttributeId,
  AttributeM2MEvent,
  AttributeM2MEventId,
  DelegationId,
  DescriptorId,
  EServiceId,
  EServiceM2MEvent,
  EServiceM2MEventId,
  TenantId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";

import { v7 as uuidv7 } from "uuid";

export function generateM2MEventId<
  ID extends AttributeM2MEventId | EServiceM2MEventId | AgreementM2MEventId
>(): ID {
  return unsafeBrandId<ID>(uuidv7());
}

export function getMockedAttributeM2MEvent(
  eventType: AttributeM2MEvent["eventType"]
): AttributeM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp: new Date(),
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
