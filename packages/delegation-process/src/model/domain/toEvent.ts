import { CreateEvent } from "pagopa-interop-commons";
import {
  Delegation,
  DelegationEventV2,
  toDelegationV2,
} from "pagopa-interop-models";

export function toCreateEventProducerDelegation(
  delegation: Delegation,
  correlationId: string
): CreateEvent<DelegationEventV2> {
  return {
    streamId: delegation.id,
    version: 0,
    event: {
      type: "DelegationSubmitted",
      event_version: 2,
      data: {
        delegation: toDelegationV2(delegation),
      },
    },
    correlationId,
  };
}
