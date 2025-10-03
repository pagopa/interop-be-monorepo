import { EServiceM2MEvent, dateToString } from "pagopa-interop-models";
import { EServiceM2MEventSQL } from "pagopa-interop-m2m-event-db-models";

export function toEServiceM2MEventSQL(
  event: EServiceM2MEvent
): EServiceM2MEventSQL {
  return {
    id: event.id,
    eventType: event.eventType,
    eventTimestamp: dateToString(event.eventTimestamp),
    eserviceId: event.eserviceId,
    descriptorId: event.descriptorId ?? null,
    producerId: event.producerId,
    producerDelegateId: event.producerDelegateId ?? null,
    producerDelegationId: event.producerDelegationId ?? null,
    visibility: event.visibility,
  };
}
