import { Logger } from "pagopa-interop-commons";
import { PurposeEventEnvelope, NewNotification } from "pagopa-interop-models";
import { P, match } from "ts-pattern";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handleDraftPurposeDeletedWithRiskAnalysisToReviewer } from "./handleDraftPurposeDeletedWithRiskAnalysisToReviewer.js";
import { handlePurposeActivatedRejectedToConsumer } from "./handlePurposeActivatedRejectedToConsumer.js";
import { handlePurposeOverQuotaToConsumer } from "./handlePurposeOverQuotaToConsumer.js";
import { handlePurposePublishedWithRiskAnalysisToReviewer } from "./handlePurposePublishedWithRiskAnalysisToReviewer.js";
import { handlePurposeQuotaAdjustmentRequestToProducer } from "./handlePurposeQuotaAdjustmentRequestToProducer.js";
import { handlePurposeQuotaAdjustmentResponseToConsumer } from "./handlePurposeQuotaAdjustmentResponseToConsumer.js";
import { handlePurposeRiskAnalysisAssignedForSigningToReviewer } from "./handlePurposeRiskAnalysisAssignedForSigningToReviewer.js";
import { handlePurposeRiskAnalysisAssignedForWritingAndSigningToReviewer } from "./handlePurposeRiskAnalysisAssignedForWritingAndSigningToReviewer.js";
import { handlePurposeRiskAnalysisAssignmentRemovedToReviewer } from "./handlePurposeRiskAnalysisAssignmentRemovedToReviewer.js";
import { handlePurposeRiskAnalysisRejectedToAdmin } from "./handlePurposeRiskAnalysisRejectedToAdmin.js";
import { handlePurposeRiskAnalysisSignedToAdmin } from "./handlePurposeRiskAnalysisSignedToAdmin.js";
import { handlePurposeRiskAnalysisSignedToReviewer } from "./handlePurposeRiskAnalysisSignedToReviewer.js";
import { handlePurposeStatusChangedToProducer } from "./handlePurposeStatusChangedToProducer.js";
import { handlePurposeSuspendedUnsuspendedToConsumer } from "./handlePurposeSuspendedUnsuspendedToConsumer.js";

export async function handlePurposeEvent(
  decodedMessage: PurposeEventEnvelope,
  logger: Logger,
  readModelService: ReadModelServiceSQL
): Promise<NewNotification[]> {
  return match(decodedMessage)
    .with({ event_version: 1 }, () => {
      logger.info(`Skipping V1 event ${decodedMessage.type} message`);
      return [];
    })
    .with(
      { type: "PurposeRiskAnalysisWorkflowCreated" },
      async ({
        data: { purpose, newReviewersToNotify, oldReviewersToNotify },
        type,
      }) => [
        ...(await handlePurposeRiskAnalysisAssignedForSigningToReviewer(
          purpose,
          newReviewersToNotify,
          logger,
          readModelService,
          type
        )),
        ...(await handlePurposeRiskAnalysisAssignmentRemovedToReviewer(
          purpose,
          oldReviewersToNotify,
          logger,
          readModelService,
          type
        )),
      ]
    )
    .with(
      { type: "PurposeRiskAnalysisSubmitted" },
      ({ data: { purpose }, type }) =>
        handlePurposeRiskAnalysisAssignedForSigningToReviewer(
          purpose,
          purpose?.reviewerWorkflow?.reviewers.map(({ id }) => id) ?? [],
          logger,
          readModelService,
          type
        )
    )
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
          "PurposeVersionSuspendedByProducer",
          "PurposeVersionUnsuspendedByProducer"
        ),
      },
      ({ data: { purpose }, type }) =>
        handlePurposeSuspendedUnsuspendedToConsumer(
          purpose,
          logger,
          readModelService,
          type
        )
    )
    .with(
      {
        type: P.union("PurposeVersionActivated", "PurposeVersionRejected"),
      },
      async ({ data: { purpose }, type }) => [
        ...(await handlePurposeActivatedRejectedToConsumer(
          purpose,
          logger,
          readModelService,
          type
        )),
        ...(await handlePurposeQuotaAdjustmentResponseToConsumer(
          purpose,
          logger,
          readModelService,
          type
        )),
      ]
    )
    .with(
      {
        type: P.union(
          "NewPurposeVersionWaitingForApproval",
          "PurposeWaitingForApproval"
        ),
      },
      async ({ data: { purpose }, type }) => [
        ...(await handlePurposeQuotaAdjustmentRequestToProducer(
          purpose,
          logger,
          readModelService,
          type
        )),
        ...(await handlePurposeOverQuotaToConsumer(
          purpose,
          logger,
          readModelService,
          type
        )),
        ...(type === "PurposeWaitingForApproval"
          ? await handlePurposePublishedWithRiskAnalysisToReviewer(
              purpose,
              logger,
              readModelService,
              type
            )
          : []),
      ]
    )
    .with({ type: "PurposeActivated" }, ({ data: { purpose }, type }) =>
      handlePurposePublishedWithRiskAnalysisToReviewer(
        purpose,
        logger,
        readModelService,
        type
      )
    )
    .with(
      {
        type: P.union(
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
          "PurposeRiskAnalysisFormEdited"
        ),
      },
      () => {
        logger.info(
          `Skipping in-app notification for event ${decodedMessage.type}`
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
          purpose,
          newReviewersToNotify,
          logger,
          readModelService
        )),
        ...(await handlePurposeRiskAnalysisAssignmentRemovedToReviewer(
          purpose,
          oldReviewersToNotify,
          logger,
          readModelService,
          type
        )),
      ]
    )
    .with(
      { type: "PurposeRiskAnalysisSelfAssigned" },
      ({ data: { purpose, oldReviewersToNotify }, type }) =>
        handlePurposeRiskAnalysisAssignmentRemovedToReviewer(
          purpose,
          oldReviewersToNotify,
          logger,
          readModelService,
          type
        )
    )
    .with(
      { type: "PurposeRiskAnalysisSigned" },
      async ({ data: { purpose } }) => [
        ...(await handlePurposeRiskAnalysisSignedToReviewer(
          purpose,
          logger,
          readModelService
        )),
        ...(await handlePurposeRiskAnalysisSignedToAdmin(
          purpose,
          logger,
          readModelService
        )),
      ]
    )
    .with({ type: "DraftPurposeDeleted" }, ({ data: { purpose } }) =>
      handleDraftPurposeDeletedWithRiskAnalysisToReviewer(
        purpose,
        logger,
        readModelService
      )
    )
    .with({ type: "PurposeRiskAnalysisRejected" }, ({ data: { purpose } }) =>
      handlePurposeRiskAnalysisRejectedToAdmin(
        purpose,
        logger,
        readModelService
      )
    )
    .exhaustive();
}
