import { CreateEvent } from "pagopa-interop-commons";
import {
  Delegation,
  DelegationEventV2,
  WithMetadata,
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

export function toRevokeEventProducerDelegation(
  delegation: Delegation,
  version: number,
  correlationId: string
): CreateEvent<DelegationEventV2> {
  return {
    streamId: delegation.id,
    version,
    event: {
      type: "DelegationRevoked",
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
  correlationId: string
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
  correlationId: string
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
