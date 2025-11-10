import { Delegation, DelegationM2MEvent } from "pagopa-interop-models";
import { generateM2MEventId } from "../../utils/uuidv7.js";

export function createDelegationM2MEvent(
  delegation: Delegation,
  resourceVersion: number,
  eventType: DelegationM2MEvent["eventType"],
  eventTimestamp: Date
): DelegationM2MEvent {
  return {
    id: generateM2MEventId(),
    eventType,
    eventTimestamp,
    resourceVersion,
    delegationId: delegation.id,
  };
}
