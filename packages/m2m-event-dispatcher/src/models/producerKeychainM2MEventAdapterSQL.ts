import { ProducerKeychainM2MEvent, dateToString } from "pagopa-interop-models";
import { ProducerKeychainM2MEventSQL } from "pagopa-interop-m2m-event-db-models";

export function toProducerKeychainM2MEventSQL(
  event: ProducerKeychainM2MEvent
): ProducerKeychainM2MEventSQL {
  return {
    id: event.id,
    eventType: event.eventType,
    eventTimestamp: dateToString(event.eventTimestamp),
    resourceVersion: event.resourceVersion,
    producerKeychainId: event.producerKeychainId,
    producerId: event.producerId,
    visibility: event.visibility,
  };
}
