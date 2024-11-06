import {
  Agreement,
  AgreementStamp,
  AgreementState,
  TenantId,
  UserId,
  agreementState,
  unsafeBrandId,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

export const createStamp = (
  userId: UserId,
  delegateId?: TenantId | undefined
): AgreementStamp => ({
  who: unsafeBrandId(userId),
  delegateId,
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
  stamp: AgreementStamp
): AgreementStamp | undefined =>
  match([requesterOrgId, destinationState])
    .with([agreement.producerId, agreementState.suspended], () => stamp)
    .with([agreement.producerId, P.any], () => undefined)
    .otherwise(() => agreement.stamps.suspensionByProducer);
