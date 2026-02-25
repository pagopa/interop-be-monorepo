import {
  M2MAdminAuthData,
  Ownership,
  ownership,
  UIAuthData,
} from "pagopa-interop-commons";
import {
  Agreement,
  AgreementStamp,
  AgreementState,
  TenantId,
  agreementState,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { ActiveDelegations } from "../model/domain/models.js";

export const createStamp = (
  authData: UIAuthData | M2MAdminAuthData,
  activeDelegations: ActiveDelegations
): AgreementStamp => {
  const isProducerDelegate =
    activeDelegations.producerDelegation?.delegateId ===
    authData.organizationId;
  const isConsumerDelegate =
    activeDelegations.consumerDelegation?.delegateId ===
    authData.organizationId;

  const delegationId = isProducerDelegate
    ? activeDelegations.producerDelegation?.id
    : isConsumerDelegate
      ? activeDelegations.consumerDelegation?.id
      : undefined;

  return {
    who: authData.userId,
    delegationId,
    when: new Date(),
  };
};

const suspendedByConsumerStamp = (
  agreement: Agreement,
  requesterOrgId: TenantId,
  destinationState: AgreementState,
  stamp: AgreementStamp,
  delegateConsumerId: TenantId | undefined
): AgreementStamp | undefined =>
  match<[TenantId | undefined, AgreementState]>([
    requesterOrgId,
    destinationState,
  ])
    .with(
      [agreement.consumerId, agreementState.suspended],
      [delegateConsumerId, agreementState.suspended],
      () => stamp
    )
    .with(
      [agreement.consumerId, P.any],
      [delegateConsumerId, P.any],
      () => undefined
    )
    .otherwise(() => agreement.stamps.suspensionByConsumer);

const suspendedByProducerStamp = (
  agreement: Agreement,
  requesterOrgId: TenantId,
  destinationState: AgreementState,
  stamp: AgreementStamp,
  delegateProducerId: TenantId | undefined
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

export function getSuspensionStamps({
  agreementOwnership,
  agreement,
  newAgreementState,
  authData,
  stamp,
  activeDelegations,
}: {
  agreementOwnership: Ownership;
  agreement: Agreement;
  newAgreementState: AgreementState;
  authData: UIAuthData | M2MAdminAuthData;
  stamp: AgreementStamp;
  activeDelegations: ActiveDelegations;
}): {
  suspensionByConsumer: AgreementStamp | undefined;
  suspensionByProducer: AgreementStamp | undefined;
} {
  return match(agreementOwnership)
    .with(ownership.PRODUCER, () => ({
      suspensionByProducer: suspendedByProducerStamp(
        agreement,
        authData.organizationId,
        newAgreementState,
        stamp,
        activeDelegations.producerDelegation?.delegateId
      ),
      suspensionByConsumer: agreement.stamps.suspensionByConsumer,
    }))
    .with(ownership.CONSUMER, () => ({
      suspensionByProducer: agreement.stamps.suspensionByProducer,
      suspensionByConsumer: suspendedByConsumerStamp(
        agreement,
        authData.organizationId,
        newAgreementState,
        stamp,
        activeDelegations.consumerDelegation?.delegateId
      ),
    }))
    .with(ownership.SELF_CONSUMER, () => ({
      suspensionByConsumer: suspendedByConsumerStamp(
        agreement,
        authData.organizationId,
        newAgreementState,
        stamp,
        activeDelegations.consumerDelegation?.delegateId
      ),
      suspensionByProducer: suspendedByProducerStamp(
        agreement,
        authData.organizationId,
        newAgreementState,
        stamp,
        activeDelegations.producerDelegation?.delegateId
      ),
    }))
    .exhaustive();
}
