import { DelegationKind, delegationKind } from "pagopa-interop-models";
import { AuthData } from "pagopa-interop-commons";
import { ActiveDelegations } from "../model/domain/models.js";

export function getRequesterDelegateKind(
  activeDelegations: ActiveDelegations,
  authData: AuthData
): DelegationKind | undefined {
  const isDelegateProducer =
    activeDelegations.producerDelegation &&
    activeDelegations.producerDelegation.delegateId === authData.organizationId;
  const isDelegateConsumer =
    activeDelegations.consumerDelegation &&
    activeDelegations.consumerDelegation.delegateId === authData.organizationId;

  return isDelegateProducer
    ? delegationKind.delegatedProducer
    : isDelegateConsumer
    ? delegationKind.delegatedConsumer
    : undefined;
}
