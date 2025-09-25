import {
  AttributeM2MEvent,
  AttributeM2MEventId,
  generateId,
  unsafeBrandId,
} from "pagopa-interop-models";

import { v7 as uuidv7 } from "uuid";

export function generateM2MEventId<ID extends AttributeM2MEventId>(): ID {
  return unsafeBrandId<ID>(uuidv7());
}

export function getMockedAttributeM2MEvent(
  eventType: AttributeM2MEvent["eventType"]
): AttributeM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp: new Date(),
    attributeId: generateId(),
  };
}
