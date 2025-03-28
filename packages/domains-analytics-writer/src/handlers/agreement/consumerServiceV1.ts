import { AgreementEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleAgreementMessageV1(
  message: AgreementEventEnvelopeV1
): Promise<void> {
  await match(message)
    .with({ type: P.union("AgreementAdded", "AgreementDeleted") }, async () =>
      Promise.resolve()
    )
    .with(
      {
        type: P.union(
          "AgreementUpdated",
          "AgreementActivated",
          "AgreementSuspended",
          "AgreementDeactivated",
          "VerifiedAttributeUpdated"
        ),
      },
      async () => Promise.resolve()
    )
    .with(
      {
        type: P.union(
          "AgreementConsumerDocumentAdded",
          "AgreementConsumerDocumentRemoved",
          "AgreementContractAdded"
        ),
      },
      async () => Promise.resolve()
    )
    .exhaustive();
}
