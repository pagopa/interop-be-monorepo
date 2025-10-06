import { AttributeM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { AttributeM2MEvent } from "pagopa-interop-models";

export function fromAttributeM2MEventSQL(
  event: AttributeM2MEventSQL
): AttributeM2MEvent {
  return AttributeM2MEvent.parse(event);
}
