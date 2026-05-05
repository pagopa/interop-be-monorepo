/* eslint-disable sonarjs/no-identical-functions */
import {
  ConsumerDelegationM2MEvent,
  ProducerDelegationM2MEvent,
  dateToString,
} from "pagopa-interop-models";
import {
  ConsumerDelegationM2MEventSQL,
  ProducerDelegationM2MEventSQL,
} from "pagopa-interop-m2m-event-db-models";

export function toConsumerDelegationM2MEventSQL(
  event: ConsumerDelegationM2MEvent
): ConsumerDelegationM2MEventSQL {
  return {
    id: event.id,
    eventType: event.eventType,
    eventTimestamp: dateToString(event.eventTimestamp),
    resourceVersion: event.resourceVersion,
    delegationId: event.delegationId,
  };
}

export function toProducerDelegationM2MEventSQL(
  event: ProducerDelegationM2MEvent
): ProducerDelegationM2MEventSQL {
  return {
    id: event.id,
    eventType: event.eventType,
    eventTimestamp: dateToString(event.eventTimestamp),
    resourceVersion: event.resourceVersion,
    delegationId: event.delegationId,
  };
}
