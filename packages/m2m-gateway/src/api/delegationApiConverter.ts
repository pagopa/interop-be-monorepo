import { delegationApi, m2mGatewayApi } from "pagopa-interop-api-clients";
import { assertDelegationKindIs } from "../utils/validators/delegationValidators.js";

export function toM2MGatewayApiConsumerDelegation(
  delegation: delegationApi.Delegation
): m2mGatewayApi.ConsumerDelegation {
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
