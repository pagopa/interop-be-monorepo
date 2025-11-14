import { ProducerKeyM2MEvent, dateToString } from "pagopa-interop-models";
import { ProducerKeyM2MEventSQL } from "pagopa-interop-m2m-event-db-models";

export function toProducerKeyM2MEventSQL(
  event: ProducerKeyM2MEvent
): ProducerKeyM2MEventSQL {
  return {
    id: event.id,
    eventType: event.eventType,
    eventTimestamp: dateToString(event.eventTimestamp),
    resourceVersion: event.resourceVersion,
    kid: event.kid,
    producerKeychainId: event.producerKeychainId,
  };
}
