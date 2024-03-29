import { AuthData } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementStamp,
  AgreementState,
  TenantId,
  agreementState,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

export const createStamp = (authData: AuthData): AgreementStamp => ({
  who: authData.userId,
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
