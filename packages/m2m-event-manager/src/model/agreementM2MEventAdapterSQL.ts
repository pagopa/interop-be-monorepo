import { AgreementM2MEventSQL } from "pagopa-interop-m2m-event-db-models";
import { AgreementM2MEvent } from "pagopa-interop-models";

export function fromAgreementM2MEventSQL(
  event: AgreementM2MEventSQL
): AgreementM2MEvent {
  return AgreementM2MEvent.parse({
    ...event,
    consumerDelegationId: event.consumerDelegationId ?? undefined,
    consumerDelegateId: event.consumerDelegateId ?? undefined,
    producerDelegationId: event.producerDelegationId ?? undefined,
    producerDelegateId: event.producerDelegateId ?? undefined,
  });
}
