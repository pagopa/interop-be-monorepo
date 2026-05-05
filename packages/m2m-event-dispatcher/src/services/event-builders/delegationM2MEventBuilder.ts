/* eslint-disable sonarjs/no-identical-functions */
import {
  Delegation,
  ProducerDelegationM2MEvent,
  ConsumerDelegationM2MEvent,
} from "pagopa-interop-models";
import { generateM2MEventId } from "../../utils/uuidv7.js";

export function createProducerDelegationM2MEvent(
  delegation: Delegation,
  resourceVersion: number,
  eventType: ProducerDelegationM2MEvent["eventType"],
  eventTimestamp: Date
): ProducerDelegationM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    resourceVersion,
    delegationId: delegation.id,
  };
}

export function createConsumerDelegationM2MEvent(
  delegation: Delegation,
  resourceVersion: number,
  eventType: ConsumerDelegationM2MEvent["eventType"],
  eventTimestamp: Date
): ConsumerDelegationM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    resourceVersion,
    delegationId: delegation.id,
  };
}
