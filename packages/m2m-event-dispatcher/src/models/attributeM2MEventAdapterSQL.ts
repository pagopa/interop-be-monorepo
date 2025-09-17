import {
  AttributeEventEnvelope,
  AttributeV1,
  dateToString,
} from "pagopa-interop-models";
import { AttributeM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { generateM2MEventId } from "../utils/uuidv7.js";

export function toNewAttributeM2MEventSQL(
  attributeId: AttributeV1["id"],
  eventType: Extract<
    AttributeEventEnvelope["type"],
    "AttributeAdded" | "MaintenanceAttributeDeleted"
  >,
  eventTimestamp: Date
): AttributeM2MEventSQL {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp: dateToString(eventTimestamp),
    attributeId,
  };
}
