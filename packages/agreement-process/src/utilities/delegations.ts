import { DelegationKind, delegationKind } from "pagopa-interop-models";
import { AuthData } from "pagopa-interop-commons";
import { ActiveDelegations } from "../model/domain/models.js";

export function getRequesterDelegateKind(
  activeDelegations: ActiveDelegations,
  authData: AuthData
): DelegationKind | undefined {
  const isDelegateProducer =
    activeDelegations.producer &&
    activeDelegations.producer.delegateId === authData.organizationId;
  const isDelegateConsumer =
    activeDelegations.consumer &&
    activeDelegations.consumer.delegateId === authData.organizationId;

  return isDelegateProducer
    ? delegationKind.delegatedProducer
    : isDelegateConsumer
    ? delegationKind.delegatedConsumer
    : undefined;
}
