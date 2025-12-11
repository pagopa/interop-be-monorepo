import { dateToString, PurposeM2MEvent } from "pagopa-interop-models";
import { PurposeM2MEventSQL } from "pagopa-interop-m2m-event-db-models";

export function toPurposeM2MEventSQL(
  event: PurposeM2MEvent
): PurposeM2MEventSQL {
  return {
    id: event.id,
    eventType: event.eventType,
    eventTimestamp: dateToString(event.eventTimestamp),
    resourceVersion: event.resourceVersion,
    purposeId: event.purposeId,
    purposeVersionId: event.purposeVersionId ?? null,
    consumerId: event.consumerId,
    producerId: event.producerId,
    consumerDelegateId: event.consumerDelegateId ?? null,
    consumerDelegationId: event.consumerDelegationId ?? null,
    producerDelegateId: event.producerDelegateId ?? null,
    producerDelegationId: event.producerDelegationId ?? null,
    visibility: event.visibility,
  };
}
