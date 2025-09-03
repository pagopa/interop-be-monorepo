/* eslint-disable functional/immutable-data */
import { AgreementEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { Logger } from "pagopa-interop-commons";

export async function handleAgreementMessageV2(
  decodedMessage: AgreementEventEnvelopeV2,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union("AgreementActivated", "AgreementUpgraded"),
      },
      async (msg): Promise<void> => {
        logger.info(`Agreement event ${msg.type} handled successfully`);
      }
    )
    .with(
      {
        type: P.union(
          "AgreementAdded",
          "AgreementDeleted",
          "DraftAgreementUpdated",
          "AgreementArchivedByUpgrade",
          "AgreementConsumerDocumentAdded",
          "AgreementConsumerDocumentRemoved",
          "AgreementSetDraftByPlatform",
          "AgreementSetMissingCertifiedAttributesByPlatform",
          "AgreementDeletedByRevokedDelegation",
          "AgreementArchivedByRevokedDelegation",
          "AgreementSubmitted",
          "AgreementUnsuspendedByProducer",
          "AgreementUnsuspendedByConsumer",
          "AgreementUnsuspendedByPlatform",
          "AgreementArchivedByConsumer",
          "AgreementSuspendedByProducer",
          "AgreementSuspendedByConsumer",
          "AgreementSuspendedByPlatform",
          "AgreementRejected"
        ),
      },
      () => {
        logger.info(
          `No document generation needed for ${decodedMessage.type} message`
        );
      }
    )
    .exhaustive();
}
