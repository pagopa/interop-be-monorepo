import { delegationApi, m2mGatewayApiV3 } from "pagopa-interop-api-clients";
import { assertDelegationKindIs } from "../utils/validators/delegationValidators.js";

export function toGetConsumerDelegationsApiQueryParams(
  params: m2mGatewayApiV3.GetConsumerDelegationsQueryParams
): delegationApi.GetDelegationsQueryParams {
  return {
    kind: delegationApi.DelegationKind.Values.DELEGATED_CONSUMER,
    delegationStates: params.states,
    delegatorIds: params.delegatorIds,
    delegateIds: params.delegateIds,
    eserviceIds: params.eserviceIds,
    offset: params.offset,
    limit: params.limit,
  };
}

export function toM2MGatewayApiConsumerDelegation(
  delegation: delegationApi.Delegation
): m2mGatewayApiV3.ConsumerDelegation {
  assertDelegationKindIs(
    delegation,
    delegationApi.DelegationKind.Values.DELEGATED_CONSUMER
  );
  return {
    id: delegation.id,
    delegatorId: delegation.delegatorId,
    delegateId: delegation.delegateId,
    eserviceId: delegation.eserviceId,
    createdAt: delegation.createdAt,
    updatedAt: delegation.updatedAt,
    rejectionReason: delegation.rejectionReason,
    revokedAt: delegation.stamps.revocation?.when,
    submittedAt: delegation.stamps.submission.when,
    activatedAt: delegation.stamps.activation?.when,
    rejectedAt: delegation.stamps.rejection?.when,
    state: delegation.state,
  };
}

export function toGetProducerDelegationsApiQueryParams(
  params: m2mGatewayApiV3.GetProducerDelegationsQueryParams
): delegationApi.GetDelegationsQueryParams {
  return {
    kind: delegationApi.DelegationKind.Values.DELEGATED_PRODUCER,
    delegationStates: params.states,
    delegatorIds: params.delegatorIds,
    delegateIds: params.delegateIds,
    eserviceIds: params.eserviceIds,
    offset: params.offset,
    limit: params.limit,
  };
}

export function toM2MGatewayApiProducerDelegation(
  delegation: delegationApi.Delegation
): m2mGatewayApiV3.ProducerDelegation {
  assertDelegationKindIs(
    delegation,
    delegationApi.DelegationKind.Values.DELEGATED_PRODUCER
  );
  return {
    id: delegation.id,
    delegatorId: delegation.delegatorId,
    delegateId: delegation.delegateId,
    eserviceId: delegation.eserviceId,
    createdAt: delegation.createdAt,
    updatedAt: delegation.updatedAt,
    rejectionReason: delegation.rejectionReason,
    revokedAt: delegation.stamps.revocation?.when,
    submittedAt: delegation.stamps.submission.when,
    activatedAt: delegation.stamps.activation?.when,
    rejectedAt: delegation.stamps.rejection?.when,
    state: delegation.state,
  };
}
