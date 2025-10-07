import { randomInt } from "crypto";
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
    resourceVersion: randomInt(1, 1000),
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
    resourceVersion: randomInt(1, 1000),
    eserviceId: generateId<EServiceId>(),
    descriptorId: generateId<DescriptorId>(),
    visibility,
    producerId: producerId ?? generateId<TenantId>(),
    producerDelegateId: producerDelegateId ?? generateId<TenantId>(),
    producerDelegationId: producerDelegateId ?? generateId<DelegationId>(),
  } as EServiceM2MEvent;
}
