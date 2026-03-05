import { AgreementEventEnvelope, NewNotification } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleAgreementManagementToProducer } from "./handleAgreementManagementToProducer.js";
import { handleAgreementSuspendedUnsuspended } from "./handleAgreementSuspendedUnsuspended.js";
import { handleAgreementActivatedRejectedToConsumer } from "./handleAgreementActivatedRejectedToConsumer.js";

export async function handleAgreementEvent(
  decodedMessage: AgreementEventEnvelope,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
    .with({ event_version: 1 }, () => {
      logger.info(`Skipping V1 event ${decodedMessage.type} message`);
      return [];
    })
    .with(
      P.union(
        { type: "AgreementSuspendedByConsumer" },
        { type: "AgreementUnsuspendedByConsumer" },
        { type: "AgreementSuspendedByProducer" },
        { type: "AgreementUnsuspendedByProducer" },
        { type: "AgreementSuspendedByPlatform" },
        { type: "AgreementUnsuspendedByPlatform" },
        { type: "AgreementArchivedByConsumer" }
      ),
      ({ data: { agreement }, type }) =>
        handleAgreementSuspendedUnsuspended(
          agreement,
          logger,
          readModelService,
          type
        )
    )
    .with(
      {
        type: P.union("AgreementSubmitted", "AgreementUpgraded"),
      },
      ({ data: { agreement }, type }) =>
        handleAgreementManagementToProducer(
          agreement,
          logger,
          readModelService,
          type
        )
    )
    .with(
      {
        type: "AgreementActivated",
      },
      async ({ data: { agreement }, type }) => [
        ...(await handleAgreementManagementToProducer(
          agreement,
          logger,
          readModelService,
          type
        )),
        ...(await handleAgreementActivatedRejectedToConsumer(
          agreement,
          logger,
          readModelService,
          type
        )),
      ]
    )
    .with(
      {
        type: "AgreementRejected",
      },
      ({ data: { agreement }, type }) =>
        handleAgreementActivatedRejectedToConsumer(
          agreement,
          logger,
          readModelService,
          type
        )
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
          "AgreementContractGenerated",
          "AgreementSignedContractGenerated"
        ),
      },
      () => {
        logger.info(
          `No need to send an in-app notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
