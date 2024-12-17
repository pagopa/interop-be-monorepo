import {
  Agreement,
  AgreementStamp,
  AgreementState,
  DelegationId,
  TenantId,
  UserId,
  agreementState,
  unsafeBrandId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

export const createStamp = (
  userId: UserId,
  delegationId?: DelegationId | undefined
): AgreementStamp => ({
  who: unsafeBrandId(userId),
  delegationId,
  when: new Date(),
});

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
