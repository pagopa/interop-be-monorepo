import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";

export function toM2MGatewayApiConsumerDelegation(
  delegation: delegationApi.Delegation & {
    kind: typeof delegationApi.DelegationKind.Values.DELEGATED_CONSUMER;
  }
): m2mGatewayApi.ConsumerDelegation {
  return {
    id: delegation.id,
    delegatorId: delegation.delegatorId,
    delegateId: delegation.delegateId,
    eserviceId: delegation.eserviceId,
    createdAt: delegation.createdAt,
    updatedAt: delegation.updatedAt,
    rejectionReason: delegation.rejectionReason,
    revokedAt: delegation.revokedAt,
    state: delegation.state,
    activationContract: delegation.activationContract,
    revocationContract: delegation.revocationContract,
    stamps: delegation.stamps,
  };
}
