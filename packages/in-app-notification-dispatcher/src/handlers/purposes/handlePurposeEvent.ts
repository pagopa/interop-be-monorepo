import { PurposeEventEnvelopeV2, NewNotification } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handlePurposeStatusChangedToProducer } from "./handlePurposeStatusChangedToProducer.js";

export async function handlePurposeEvent(
  decodedMessage: PurposeEventEnvelopeV2,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
    .with(
      {
        type: P.union(
          "PurposeVersionSuspendedByConsumer",
          "PurposeVersionUnsuspendedByConsumer",
          "PurposeArchived"
        ),
      },
      ({ data: { purpose }, type }) =>
        handlePurposeStatusChangedToProducer(
          purpose,
          logger,
          readModelService,
          type
        )
    )
    .with(
      {
        type: P.union(
          "NewPurposeVersionWaitingForApproval",
          "PurposeWaitingForApproval",
          "PurposeVersionRejected",
          "PurposeVersionActivated",
          "DraftPurposeDeleted",
          "WaitingForApprovalPurposeDeleted",
          "PurposeAdded",
          "DraftPurposeUpdated",
          "PurposeActivated",
          "PurposeVersionOverQuotaUnsuspended",
          "PurposeVersionSuspendedByProducer",
          "PurposeVersionUnsuspendedByProducer",
          "WaitingForApprovalPurposeVersionDeleted",
          "NewPurposeVersionActivated",
          "PurposeCloned",
          "PurposeDeletedByRevokedDelegation",
          "PurposeVersionArchivedByRevokedDelegation"
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
