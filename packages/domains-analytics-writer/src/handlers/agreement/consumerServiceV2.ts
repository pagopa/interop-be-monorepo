import { AgreementEventEnvelopeV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleAgreementMessageV2(
  message: AgreementEventEnvelopeV2
): Promise<void> {
  await match(message)
    .with({ type: "AgreementDeleted" }, async () => Promise.resolve())
    .with(
      { type: "AgreementAdded" },
      { type: "DraftAgreementUpdated" },
      { type: "AgreementSubmitted" },
      { type: "AgreementActivated" },
      { type: "AgreementUpgraded" },
      { type: "AgreementUnsuspendedByProducer" },
      { type: "AgreementUnsuspendedByConsumer" },
      { type: "AgreementUnsuspendedByPlatform" },
      { type: "AgreementArchivedByConsumer" },
      { type: "AgreementSuspendedByProducer" },
      { type: "AgreementSuspendedByConsumer" },
      { type: "AgreementSuspendedByPlatform" },
      { type: "AgreementRejected" },
      { type: "AgreementConsumerDocumentAdded" },
      { type: "AgreementConsumerDocumentRemoved" },
      { type: "AgreementArchivedByUpgrade" },
      { type: "AgreementSetDraftByPlatform" },
      { type: "AgreementSetMissingCertifiedAttributesByPlatform" },
      { type: "AgreementDeletedByRevokedDelegation" },
      { type: "AgreementArchivedByRevokedDelegation" },
      async () => Promise.resolve()
    )
    .exhaustive();
}
