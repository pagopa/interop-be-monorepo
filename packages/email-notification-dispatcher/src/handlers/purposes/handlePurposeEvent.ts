import {
  EmailNotificationMessagePayload,
  PurposeEvent,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { HandlerParams } from "../../models/handlerParams.js";
import { handlePurposeVersionSuspendedByConsumer } from "./handlePurposeVersionSuspendedByConsumer.js";
import { handlePurposeVersionUnsuspendedByConsumer } from "./handlePurposeVersionUnsuspendedByConsumer.js";
import { handlePurposeArchived } from "./handlePurposeArchived.js";
import { handlePurposeVersionActivatedFirstVersion } from "./handlePurposeVersionActivatedFirstVersion.js";
import { handlePurposeVersionRejectedFirstVersion } from "./handlePurposeVersionRejectedFirstVersion.js";
import { handlePurposeVersionSuspendedByProducer } from "./handlePurposeVersionSuspendedByProducer.js";
import { handlePurposeVersionUnsuspendedByProducer } from "./handlePurposeVersionUnsuspendedByProducer.js";
import { handleNewPurposeVersionWaitingForApprovalToProducer } from "./handleNewPurposeVersionWaitingForApprovalToProducer.js";
import { handlePurposeWaitingForApprovalToProducer } from "./handlePurposeWaitingForApprovalToProducer.js";
import { handleNewPurposeVersionWaitingForApprovalToConsumer } from "./handleNewPurposeVersionWaitingForApprovalToConsumer.js";
import { handlePurposeWaitingForApprovalToConsumer } from "./handlePurposeWaitingForApprovalToConsumer.js";
import { handlePurposeVersionActivatedOtherVersion } from "./handlePurposeVersionActivatedOtherVersion.js";
import { handlePurposeVersionRejectedOtherVersion } from "./handlePurposeVersionRejectedOtherVersion.js";

export async function handlePurposeEvent(
  params: HandlerParams<typeof PurposeEvent>
): Promise<EmailNotificationMessagePayload[]> {
  const {
    decodedMessage,
    logger,
    readModelService,
    templateService,
    correlationId,
  } = params;
  return match(decodedMessage)
    .with({ event_version: 1 }, () => {
      logger.info(`Skipping V1 event ${decodedMessage.type} message`);
      return [];
    })
    .with(
      { type: "PurposeVersionActivated" },
      async ({ data: { purpose } }) => [
        ...(await handlePurposeVersionActivatedFirstVersion({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
        ...(await handlePurposeVersionActivatedOtherVersion({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
      ]
    )
    .with({ type: "PurposeVersionRejected" }, async ({ data: { purpose } }) => [
      ...(await handlePurposeVersionRejectedFirstVersion({
        purposeV2Msg: purpose,
        logger,
        readModelService,
        templateService,
        correlationId,
      })),
      ...(await handlePurposeVersionRejectedOtherVersion({
        purposeV2Msg: purpose,
        logger,
        readModelService,
        templateService,
        correlationId,
      })),
    ])
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
      { type: "NewPurposeVersionWaitingForApproval" },
      async ({ data: { purpose } }) => [
        ...(await handleNewPurposeVersionWaitingForApprovalToProducer({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
        ...(await handleNewPurposeVersionWaitingForApprovalToConsumer({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
      ]
    )
    .with(
      { type: "PurposeWaitingForApproval" },
      async ({ data: { purpose } }) => [
        ...(await handlePurposeWaitingForApprovalToProducer({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
        ...(await handlePurposeWaitingForApprovalToConsumer({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
      ]
    )
    .with(
      {
        type: P.union(
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
          "RiskAnalysisDocumentGenerated",
          "RiskAnalysisSignedDocumentGenerated"
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
