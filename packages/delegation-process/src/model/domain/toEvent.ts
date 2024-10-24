import { CreateEvent } from "pagopa-interop-commons";
import {
  CorrelationId,
  Delegation,
  DelegationEventV2,
  WithMetadata,
  toDelegationV2,
} from "pagopa-interop-models";

export function toCreateEventProducerDelegation(
  delegation: Delegation,
  correlationId: CorrelationId
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

export function toCreateEventApproveDelegation(
  delegation: WithMetadata<Delegation>,
  correlationId: CorrelationId
): CreateEvent<DelegationEventV2> {
  return {
    streamId: delegation.data.id,
    version: delegation.metadata.version,
    event: {
      type: "DelegationApproved",
      event_version: 2,
      data: {
        delegation: toDelegationV2(delegation.data),
      },
    },
    correlationId,
  };
}

export function toCreateEventRejectDelegation(
  delegation: WithMetadata<Delegation>,
  correlationId: CorrelationId
): CreateEvent<DelegationEventV2> {
  return {
    streamId: delegation.data.id,
    version: delegation.metadata.version,
    event: {
      type: "DelegationRejected",
      event_version: 2,
      data: {
        delegation: toDelegationV2(delegation.data),
      },
    },
    correlationId,
  };
}
