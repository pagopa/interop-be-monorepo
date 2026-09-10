import {
  EmailNotificationMessagePayload,
  PurposeEvent,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";

import { HandlerParams } from "../../models/handlerParams.js";
import { handleNewPurposeVersionWaitingForApprovalToConsumer } from "./handleNewPurposeVersionWaitingForApprovalToConsumer.js";
import { handleNewPurposeVersionWaitingForApprovalToProducer } from "./handleNewPurposeVersionWaitingForApprovalToProducer.js";
import { handlePurposeArchived } from "./handlePurposeArchived.js";
import { handlePurposePublishedWithRiskAnalysisToReviewer } from "./handlePurposePublishedWithRiskAnalysisToReviewer.js";
import { handlePurposeRiskAnalysisAssignedForSigningToReviewer } from "./handlePurposeRiskAnalysisAssignedForSigningToReviewer.js";
import { handlePurposeRiskAnalysisAssignedForWritingAndSigningToReviewer } from "./handlePurposeRiskAnalysisAssignedForWritingAndSigningToReviewer.js";
import { handlePurposeRiskAnalysisAssignmentRemovedToReviewer } from "./handlePurposeRiskAnalysisAssignmentRemovedToReviewer.js";
import { handlePurposeRiskAnalysisSignedToAdmin } from "./handlePurposeRiskAnalysisSignedToAdmin.js";
import { handlePurposeRiskAnalysisSignedToReviewer } from "./handlePurposeRiskAnalysisSignedToReviewer.js";
import { handlePurposeVersionActivatedFirstVersion } from "./handlePurposeVersionActivatedFirstVersion.js";
import { handlePurposeVersionActivatedOtherVersion } from "./handlePurposeVersionActivatedOtherVersion.js";
import { handlePurposeVersionRejectedFirstVersion } from "./handlePurposeVersionRejectedFirstVersion.js";
import { handlePurposeVersionRejectedOtherVersion } from "./handlePurposeVersionRejectedOtherVersion.js";
import { handlePurposeVersionSuspendedByConsumer } from "./handlePurposeVersionSuspendedByConsumer.js";
import { handlePurposeVersionSuspendedByProducer } from "./handlePurposeVersionSuspendedByProducer.js";
import { handlePurposeVersionUnsuspendedByConsumer } from "./handlePurposeVersionUnsuspendedByConsumer.js";
import { handlePurposeVersionUnsuspendedByProducer } from "./handlePurposeVersionUnsuspendedByProducer.js";
import { handlePurposeWaitingForApprovalToConsumer } from "./handlePurposeWaitingForApprovalToConsumer.js";
import { handlePurposeWaitingForApprovalToProducer } from "./handlePurposeWaitingForApprovalToProducer.js";

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
        ...(await handlePurposePublishedWithRiskAnalysisToReviewer({
          purposeV2Msg: purpose,
          eventType: "PurposeWaitingForApproval",
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
      ]
    )
    .with({ type: "PurposeActivated" }, ({ data: { purpose }, type }) =>
      handlePurposePublishedWithRiskAnalysisToReviewer({
        purposeV2Msg: purpose,
        eventType: type,
        logger,
        readModelService,
        templateService,
        correlationId,
      })
    )
    .with(
      { type: "PurposeRiskAnalysisWorkflowCreated" },
      async ({
        data: { purpose, newReviewersToNotify, oldReviewersToNotify },
        type,
      }) => [
        ...(await handlePurposeRiskAnalysisAssignedForSigningToReviewer({
          purposeV2Msg: purpose,
          reviewerIds: newReviewersToNotify,
          eventType: type,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
        ...(await handlePurposeRiskAnalysisAssignmentRemovedToReviewer({
          purposeV2Msg: purpose,
          reviewerIds: oldReviewersToNotify,
          eventType: type,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
      ]
    )
    .with(
      { type: "PurposeRiskAnalysisSubmitted" },
      ({ data: { purpose }, type }) =>
        handlePurposeRiskAnalysisAssignedForSigningToReviewer({
          purposeV2Msg: purpose,
          reviewerIds:
            purpose?.reviewerWorkflow?.reviewers.map(({ id }) => id) ?? [],
          eventType: type,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      {
        type: P.union(
          "DraftPurposeDeleted",
          "WaitingForApprovalPurposeDeleted",
          "PurposeAdded",
          "DraftPurposeUpdated",
          "PurposeVersionOverQuotaUnsuspended",
          "WaitingForApprovalPurposeVersionDeleted",
          "NewPurposeVersionActivated",
          "PurposeCloned",
          "PurposeDeletedByRevokedDelegation",
          "PurposeVersionArchivedByRevokedDelegation",
          "RiskAnalysisDocumentGenerated",
          "RiskAnalysisSignedDocumentGenerated",
          "MaintenancePurposeRiskAnalysisSetTenantKind",
          "PurposeRiskAnalysisRejected",
          "PurposeRiskAnalysisFormEdited"
        ),
      },
      () => {
        logger.info(
          `Skipping email notification for event ${decodedMessage.type}`
        );
        return [];
      }
    )
    .with(
      { type: "PurposeRiskAnalysisAssigned" },
      async ({
        data: { purpose, newReviewersToNotify, oldReviewersToNotify },
        type,
      }) => [
        ...(await handlePurposeRiskAnalysisAssignedForWritingAndSigningToReviewer(
          {
            purposeV2Msg: purpose,
            reviewerIds: newReviewersToNotify,
            logger,
            readModelService,
            templateService,
            correlationId,
          }
        )),
        ...(await handlePurposeRiskAnalysisAssignmentRemovedToReviewer({
          purposeV2Msg: purpose,
          reviewerIds: oldReviewersToNotify,
          eventType: type,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
      ]
    )
    .with(
      { type: "PurposeRiskAnalysisSelfAssigned" },
      ({ data: { purpose, oldReviewersToNotify }, type }) =>
        handlePurposeRiskAnalysisAssignmentRemovedToReviewer({
          purposeV2Msg: purpose,
          reviewerIds: oldReviewersToNotify,
          eventType: type,
          logger,
          readModelService,
          templateService,
          correlationId,
        })
    )
    .with(
      { type: "PurposeRiskAnalysisSigned" },
      async ({ data: { purpose } }) => [
        ...(await handlePurposeRiskAnalysisSignedToReviewer({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
        ...(await handlePurposeRiskAnalysisSignedToAdmin({
          purposeV2Msg: purpose,
          logger,
          readModelService,
          templateService,
          correlationId,
        })),
      ]
    )
    .exhaustive();
}
