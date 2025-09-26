import {
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

export function getMockedEServiceM2MEvent(
  eventType: EServiceM2MEvent["eventType"]
): EServiceM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp: new Date(),
    eserviceId: generateId<EServiceId>(),
    descriptorId: generateId<DescriptorId>(),
    visibility: m2mEventVisibility.restricted,
    producerId: generateId<TenantId>(),
    producerDelegateId: generateId<TenantId>(),
    producerDelegationId: generateId<DelegationId>(),
  };
}
