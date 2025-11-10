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
import { handleNewPurposeVersionWaitingForApproval } from "./handleNewPurposeVersionWaitingForApproval.js";
import { handlePurposeWaitingForApproval } from "./handlePurposeWaitingForApproval.js";
import { handleNewPurposeVersionWaitingForApprovalOverthreshold } from "./handleNewPurposeVersionWaitingForApprovalOverthreshold.js";
import { handlePurposeWaitingForApprovalOverthreshold } from "./handlePurposeWaitingForApprovalOverthreshold.js";
import { handlePurposeVersionActivatedQuotaAdjustment } from "./handlePurposeVersionActivatedQuotaAdjustment.js";
import { handlePurposeVersionRejectedQuotaAdjustment } from "./handlePurposeVersionRejectedQuotaAdjustment.js";

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
    .with(
      { type: "PurposeVersionActivated" },
      async ({ data: { purpose } }) => [
        ...(await handlePurposeVersionActivated({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
        ...(await handlePurposeVersionActivatedQuotaAdjustment({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
      ]
    )
    .with({ type: "PurposeVersionRejected" }, async ({ data: { purpose } }) => [
      ...(await handlePurposeVersionRejected({
        purposeV2Msg: purpose,
        logger,
        readModelService,
        templateService,
        correlationId,
      })),
      ...(await handlePurposeVersionRejectedQuotaAdjustment({
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
        ...(await handleNewPurposeVersionWaitingForApproval({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
        ...(await handleNewPurposeVersionWaitingForApprovalOverthreshold({
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
        ...(await handlePurposeWaitingForApproval({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
        ...(await handlePurposeWaitingForApprovalOverthreshold({
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
