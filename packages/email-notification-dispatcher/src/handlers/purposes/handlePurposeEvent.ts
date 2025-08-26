import {
  EmailNotificationMessagePayload,
  PurposeEventV2,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";
import { handlePurposeVersionSuspendedByProducer } from "./handlePurposeVersionSuspendedByProducer.js";
import { handlePurposeVersionUnsuspendedByProducer } from "./handlePurposeVersionUnsuspendedByProducer.js";

export async function handlePurposeEvent(
  params: HandlerParams<typeof PurposeEventV2>
): Promise<EmailNotificationMessagePayload[]> {
  const {
    decodedMessage,
    logger,
    readModelService,
    templateService,
    userService,
    correlationId,
  } = params;
  return match(decodedMessage)
    .with(
      { type: "PurposeVersionSuspendedByProducer" },
      ({ data: { purpose } }) =>
        handlePurposeVersionSuspendedByProducer({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          userService,
          correlationId,
        })
    )
    .with(
      { type: "PurposeVersionUnsuspendedByProducer" },
      ({ data: { purpose } }) =>
        handlePurposeVersionUnsuspendedByProducer({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          userService,
          correlationId,
        })
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
          "PurposeArchived",
          "PurposeVersionOverQuotaUnsuspended",
          "PurposeVersionSuspendedByConsumer",
          "PurposeVersionUnsuspendedByConsumer",
          "WaitingForApprovalPurposeVersionDeleted",
          "NewPurposeVersionActivated",
          "PurposeCloned",
          "PurposeDeletedByRevokedDelegation",
          "PurposeVersionArchivedByRevokedDelegation"
        ),
      },
      () => {
        logger.info(
          `No need to send an email notification for ${decodedMessage.type} message`
        );
        return [];
      }
    )
    .exhaustive();
}
