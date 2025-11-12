import { KeyM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { KeyM2MEvent } from "pagopa-interop-models";

export function fromKeyM2MEventSQL(event: KeyM2MEventSQL): KeyM2MEvent {
  return KeyM2MEvent.parse(event);
}
