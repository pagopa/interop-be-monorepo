import {
  AttributeEventEnvelope,
  dateToString,
  unsafeBrandId,
} from "pagopa-interop-models";
import { AttributeM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { generateM2MEventId } from "../utils/uuidv7.js";

export function toNewAttributeM2MEventSQL(
  event: AttributeEventEnvelope,
  eventTimestamp: Date
): AttributeM2MEventSQL {
  return {
    id: generateM2MEventId(),
    eventType: event.type,
    eventTimestamp: dateToString(eventTimestamp),
    attributeId: unsafeBrandId(event.stream_id),
  };
}
