/* eslint-disable sonarjs/no-identical-functions */
import {
  ConsumerDelegationM2MEvent,
  ProducerDelegationM2MEvent,
} from "pagopa-interop-models";
import {
  ConsumerDelegationM2MEventSQL,
  ProducerDelegationM2MEventSQL,
} from "pagopa-interop-m2m-event-db-models";

export function fromConsumerDelegationM2MEventSQL(
  event: ConsumerDelegationM2MEventSQL
): ConsumerDelegationM2MEvent {
  return ConsumerDelegationM2MEvent.parse(event);
}

export function fromProducerDelegationM2MEventSQL(
  event: ProducerDelegationM2MEventSQL
): ProducerDelegationM2MEvent {
  return ProducerDelegationM2MEvent.parse(event);
}
