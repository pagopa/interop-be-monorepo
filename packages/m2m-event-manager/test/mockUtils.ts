import {
  AttributeId,
  AttributeM2MEvent,
  AttributeM2MEventId,
  DelegationId,
  DescriptorId,
  EServiceId,
  EServiceM2MEvent,
  EServiceM2MEventId,
  M2MEventVisibility,
  TenantId,
  generateId,
  m2mEventVisibility,
  unsafeBrandId,
} from "pagopa-interop-models";

import { v7 as uuidv7 } from "uuid";

export function generateM2MEventId<
  ID extends AttributeM2MEventId | EServiceM2MEventId
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
  visibility = m2mEventVisibility.public,
  producerId,
  producerDelegateId,
}: {
  eventType: EServiceM2MEvent["eventType"];
  visibility?: M2MEventVisibility;
  producerId?: TenantId;
  producerDelegateId?: TenantId;
}): EServiceM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp: new Date(),
    eserviceId: generateId<EServiceId>(),
    descriptorId: generateId<DescriptorId>(),
    visibility,
    producerId:
      visibility === m2mEventVisibility.restricted
        ? producerId ?? generateId<TenantId>()
        : undefined,
    producerDelegateId:
      visibility === m2mEventVisibility.restricted
        ? producerDelegateId ?? generateId<TenantId>()
        : undefined,
    producerDelegationId:
      visibility === m2mEventVisibility.restricted && producerDelegateId
        ? generateId<DelegationId>()
        : undefined,
  } as EServiceM2MEvent;
}
