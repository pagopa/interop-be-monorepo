import { Attribute, AttributeM2MEvent } from "pagopa-interop-models";
import { generateM2MEventId } from "../../utils/uuidv7.js";

export function createAttributeM2MEvent(
  attribute: Attribute,
  resourceVersion: number,
  eventType: AttributeM2MEvent["eventType"],
  eventTimestamp: Date
): AttributeM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    resourceVersion,
    attributeId: attribute.id,
  };
}
