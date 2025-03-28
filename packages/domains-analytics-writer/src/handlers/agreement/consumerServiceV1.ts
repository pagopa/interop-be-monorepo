import { AgreementEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handleAgreementMessageV1(
  message: AgreementEventEnvelopeV1
): Promise<void> {
  await match(message)
    .with(
      P.union({ type: "AgreementAdded" }, { type: "AgreementDeleted" }),
      async () => Promise.resolve()
    )
    .with(
      P.union(
        { type: "AgreementUpdated" },
        { type: "AgreementActivated" },
        { type: "AgreementSuspended" },
        { type: "AgreementDeactivated" },
        { type: "VerifiedAttributeUpdated" }
      ),
      async () => Promise.resolve()
    )
    .with(
      P.union(
        { type: "AgreementConsumerDocumentAdded" },
        { type: "AgreementConsumerDocumentRemoved" },
        { type: "AgreementContractAdded" }
      ),
      async () => Promise.resolve()
    )
    .exhaustive();
}
