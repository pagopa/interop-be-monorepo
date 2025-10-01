import { EServiceM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { EServiceM2MEvent } from "pagopa-interop-models";

export function fromEServiceM2MEventSQL(
  event: EServiceM2MEventSQL
): EServiceM2MEvent {
  return EServiceM2MEvent.parse({
    ...event,
    descriptorId: event.descriptorId ?? undefined,
    producerDelegationId: event.producerDelegationId ?? undefined,
    producerDelegateId: event.producerDelegateId ?? undefined,
  });
}
