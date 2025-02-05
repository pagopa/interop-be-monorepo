import { AgreementEventEnvelopeV1 } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleAgreementMessageV1(
  message: AgreementEventEnvelopeV1
): Promise<void> {
  await match(message)
    .with({ type: "AgreementAdded" }, async () => Promise.resolve())
    .with({ type: "AgreementDeleted" }, async () => Promise.resolve())
    .with(
      { type: "AgreementUpdated" },
      { type: "AgreementActivated" },
      { type: "AgreementSuspended" },
      { type: "AgreementDeactivated" },
      { type: "VerifiedAttributeUpdated" },
      async () => Promise.resolve()
    )
    .with({ type: "AgreementConsumerDocumentAdded" }, async () =>
      Promise.resolve()
    )
    .with({ type: "AgreementConsumerDocumentRemoved" }, async () =>
      Promise.resolve()
    )
    .with({ type: "AgreementContractAdded" }, async () => Promise.resolve())
    .exhaustive();
}
