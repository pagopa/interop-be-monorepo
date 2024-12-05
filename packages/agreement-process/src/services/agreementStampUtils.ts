import { AuthData } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementStamp,
  AgreementState,
  TenantId,
  agreementState,
  delegationKind,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { ActiveDelegations } from "../model/domain/models.js";
import { getRequesterDelegateKind } from "../utilities/delegations.js";

export const createStamp = (
  authData: AuthData,
  activeDelegations: ActiveDelegations
): AgreementStamp => {
  const requesterDelegateKind = getRequesterDelegateKind(
    activeDelegations,
    authData
  );

  const delegationId = match(requesterDelegateKind)
    .with(
      delegationKind.delegatedProducer,
      () => activeDelegations.producerDelegation?.id
    )
    .with(
      delegationKind.delegatedConsumer,
      () => activeDelegations.consumerDelegation?.id
    )
    .with(undefined, () => undefined)
    .exhaustive();

  return {
    who: authData.userId,
    delegationId,
    when: new Date(),
  };
};

export const suspendedByConsumerStamp = (
  agreement: Agreement,
  requesterOrgId: TenantId,
  destinationState: AgreementState,
  stamp: AgreementStamp
): AgreementStamp | undefined =>
  match([requesterOrgId, destinationState])
    .with([agreement.consumerId, agreementState.suspended], () => stamp)
    .with([agreement.consumerId, P.any], () => undefined)
    .otherwise(() => agreement.stamps.suspensionByConsumer);

export const suspendedByProducerStamp = (
  agreement: Agreement,
  requesterOrgId: TenantId,
  destinationState: AgreementState,
  stamp: AgreementStamp,
  delegateProducerId?: TenantId | undefined
): AgreementStamp | undefined =>
  match<[TenantId | undefined, AgreementState]>([
    requesterOrgId,
    destinationState,
  ])
    .with(
      [agreement.producerId, agreementState.suspended],
      [delegateProducerId, agreementState.suspended],
      () => stamp
    )
    .with(
      [agreement.producerId, P.any],
      [delegateProducerId, P.any],
      () => undefined
    )
    .otherwise(() => agreement.stamps.suspensionByProducer);
