import { KeyM2MEvent, dateToString } from "pagopa-interop-models";
import { KeyM2MEventSQL } from "pagopa-interop-m2m-event-db-models";

export function toKeyM2MEventSQL(event: KeyM2MEvent): KeyM2MEventSQL {
  return {
    id: event.id,
    eventType: event.eventType,
    eventTimestamp: dateToString(event.eventTimestamp),
    resourceVersion: event.resourceVersion,
    kid: event.kid,
  };
}
