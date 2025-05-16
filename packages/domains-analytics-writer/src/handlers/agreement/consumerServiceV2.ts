import { AgreementEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { DBContext } from "../../db/db.js";

export async function handleAgreementMessageV2(
  messages: AgreementEventEnvelopeV2[],
  _dbContext: DBContext
): Promise<void> {
  for (const message of messages) {
    await match(message)
      .with({ type: "AgreementDeleted" }, async () => Promise.resolve())
      .with(
        {
          type: P.union(
            "AgreementAdded",
            "DraftAgreementUpdated",
            "AgreementSubmitted",
            "AgreementActivated",
            "AgreementUpgraded",
            "AgreementUnsuspendedByProducer",
            "AgreementUnsuspendedByConsumer",
            "AgreementUnsuspendedByPlatform",
            "AgreementArchivedByConsumer",
            "AgreementSuspendedByProducer",
            "AgreementSuspendedByConsumer",
            "AgreementSuspendedByPlatform",
            "AgreementRejected",
            "AgreementConsumerDocumentAdded",
            "AgreementConsumerDocumentRemoved",
            "AgreementArchivedByUpgrade",
            "AgreementSetDraftByPlatform",
            "AgreementSetMissingCertifiedAttributesByPlatform",
            "AgreementDeletedByRevokedDelegation",
            "AgreementArchivedByRevokedDelegation"
          ),
        },
        async () => Promise.resolve()
      )
      .exhaustive();
  }
}
