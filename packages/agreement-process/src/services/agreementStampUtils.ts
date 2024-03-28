import { AuthData } from "pagopa-interop-commons";
import {
  Agreement,
  AgreementStamp,
  AgreementState,
  TenantId,
  agreementState,
  operationForbidden,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

export const createStamp = (authData: AuthData): AgreementStamp =>
  match(authData)
    .with(
      { tokenType: "empty" },
      { tokenType: "internal" },
      { tokenType: "m2m" },
      () => {
        throw operationForbidden;
      }
    )
    .with({ tokenType: "ui" }, (d) => ({
      who: d.userId,
      when: new Date(),
    }))
    .exhaustive();

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
