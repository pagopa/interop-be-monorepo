import {
  EmailNotificationMessagePayload,
  PurposeEventV2,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";
import { handlePurposeVersionSuspendedByConsumer } from "./handlePurposeVersionSuspendedByConsumer.js";
import { handlePurposeVersionUnsuspendedByConsumer } from "./handlePurposeVersionUnsuspendedByConsumer.js";
import { handlePurposeArchived } from "./handlePurposeArchived.js";
import { handlePurposeVersionActivated } from "./handlePurposeVersionActivated.js";
import { handlePurposeVersionRejected } from "./handlePurposeVersionRejected.js";
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
    correlationId,
  } = params;
  return match(decodedMessage)
    .with({ type: "PurposeVersionActivated" }, ({ data: { purpose } }) =>
      handlePurposeVersionActivated({
        purposeV2Msg: purpose,
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    )
    .with({ type: "PurposeVersionRejected" }, ({ data: { purpose } }) =>
      handlePurposeVersionRejected({
        purposeV2Msg: purpose,
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    )
    .with(
      { type: "PurposeVersionSuspendedByProducer" },
      ({ data: { purpose } }) =>
        handlePurposeVersionSuspendedByProducer({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "PurposeVersionSuspendedByConsumer" },
      ({ data: { purpose } }) =>
        handlePurposeVersionSuspendedByConsumer({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
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
          correlationId,
        })
    )
    .with(
      { type: "PurposeVersionUnsuspendedByConsumer" },
      ({ data: { purpose } }) =>
        handlePurposeVersionUnsuspendedByConsumer({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with({ type: "PurposeArchived" }, ({ data: { purpose } }) =>
      handlePurposeArchived({
        purposeV2Msg: purpose,
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    )
    .with(
      {
        type: P.union(
          "NewPurposeVersionWaitingForApproval",
          "PurposeWaitingForApproval",
          "DraftPurposeDeleted",
          "WaitingForApprovalPurposeDeleted",
          "PurposeAdded",
          "DraftPurposeUpdated",
          "PurposeActivated",
          "PurposeVersionOverQuotaUnsuspended",
          "WaitingForApprovalPurposeVersionDeleted",
          "NewPurposeVersionActivated",
          "PurposeCloned",
          "PurposeDeletedByRevokedDelegation",
          "PurposeVersionArchivedByRevokedDelegation",
          "RiskAnalysisDocumentGenerated"
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
