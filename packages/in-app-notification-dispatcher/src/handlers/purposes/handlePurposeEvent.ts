import { Logger } from "pagopa-interop-commons";
import { PurposeEventEnvelope, NewNotification } from "pagopa-interop-models";
import { P, match } from "ts-pattern";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handlePurposeActivatedRejectedToConsumer } from "./handlePurposeActivatedRejectedToConsumer.js";
import { handlePurposeOverQuotaToConsumer } from "./handlePurposeOverQuotaToConsumer.js";
import { handlePurposeQuotaAdjustmentRequestToProducer } from "./handlePurposeQuotaAdjustmentRequestToProducer.js";
import { handlePurposeQuotaAdjustmentResponseToConsumer } from "./handlePurposeQuotaAdjustmentResponseToConsumer.js";
import { handlePurposeRiskAnalysisAssignedForSigningToReviewer } from "./handlePurposeRiskAnalysisAssignedForSigningToReviewer.js";
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
      ({ data: { purpose, newReviewersToNotify }, type }) =>
        handlePurposeRiskAnalysisAssignedForSigningToReviewer(
          purpose,
          newReviewersToNotify,
          logger,
          readModelService,
          type
        )
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
          "RiskAnalysisSignedDocumentGenerated",
          "MaintenancePurposeRiskAnalysisSetTenantKind",
          "PurposeRiskAnalysisAssigned",
          "PurposeRiskAnalysisSelfAssigned",
          "PurposeRiskAnalysisSigned",
          "PurposeRiskAnalysisRejected",
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
    .exhaustive();
}
