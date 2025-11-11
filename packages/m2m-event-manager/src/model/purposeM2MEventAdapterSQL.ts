import { PurposeM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { PurposeM2MEvent } from "pagopa-interop-models";

export function fromPurposeM2MEventSQL(
  event: PurposeM2MEventSQL
): PurposeM2MEvent {
  return PurposeM2MEvent.parse({
    ...event,
    consumerDelegationId: event.consumerDelegationId ?? undefined,
    consumerDelegateId: event.consumerDelegateId ?? undefined,
    producerDelegationId: event.producerDelegationId ?? undefined,
    producerDelegateId: event.producerDelegateId ?? undefined,
  });
}
