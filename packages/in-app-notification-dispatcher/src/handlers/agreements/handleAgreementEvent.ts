import {
  AgreementEventEnvelopeV2,
  NewNotification,
} from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleAgreementManagementToProducer } from "./handleAgreementManagementToProducer.js";
import { handleAgreementSuspendedUnsuspended } from "./handleAgreementSuspendedUnsuspended.js";

export async function handleAgreementEvent(
  decodedMessage: AgreementEventEnvelopeV2,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
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
        type: P.union(
          "AgreementActivated",
          "AgreementSubmitted",
          "AgreementUpgraded"
        ),
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
        type: P.union(
          "AgreementRejected",
          "AgreementAdded",
          "AgreementDeleted",
          "DraftAgreementUpdated",
          "AgreementArchivedByUpgrade",
          "AgreementConsumerDocumentAdded",
          "AgreementConsumerDocumentRemoved",
          "AgreementSetDraftByPlatform",
          "AgreementSetMissingCertifiedAttributesByPlatform",
          "AgreementDeletedByRevokedDelegation",
          "AgreementArchivedByRevokedDelegation"
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
