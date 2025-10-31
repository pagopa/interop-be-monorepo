import { AgreementM2MEvent, dateToString } from "pagopa-interop-models";
import { AgreementM2MEventSQL } from "pagopa-interop-m2m-event-db-models";

export function toAgreementM2MEventSQL(
  event: AgreementM2MEvent
): AgreementM2MEventSQL {
  return {
    id: event.id,
    eventType: event.eventType,
    eventTimestamp: dateToString(event.eventTimestamp),
    agreementId: event.agreementId,
    consumerId: event.consumerId,
    producerId: event.producerId,
    consumerDelegateId: event.consumerDelegateId ?? null,
    consumerDelegationId: event.consumerDelegationId ?? null,
    producerDelegateId: event.producerDelegateId ?? null,
    producerDelegationId: event.producerDelegationId ?? null,
    visibility: event.visibility,
  };
}
