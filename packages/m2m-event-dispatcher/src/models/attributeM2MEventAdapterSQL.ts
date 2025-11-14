import { AttributeM2MEvent, dateToString } from "pagopa-interop-models";
import { AttributeM2MEventSQL } from "pagopa-interop-m2m-event-db-models";

export function toAttributeM2MEventSQL(
  event: AttributeM2MEvent
): AttributeM2MEventSQL {
  return {
    id: event.id,
    eventType: event.eventType,
    eventTimestamp: dateToString(event.eventTimestamp),
    resourceVersion: event.resourceVersion,
    attributeId: event.attributeId,
  };
}
