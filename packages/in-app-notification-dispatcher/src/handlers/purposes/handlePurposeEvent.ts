import { Logger } from "pagopa-interop-commons";
import { PurposeEventEnvelope, NewNotification } from "pagopa-interop-models";
import { P, match } from "ts-pattern";

import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handlePurposeActivatedRejectedToConsumer } from "./handlePurposeActivatedRejectedToConsumer.js";
import { handlePurposeOverQuotaToConsumer } from "./handlePurposeOverQuotaToConsumer.js";
import { handlePurposePublishedWithRiskAnalysisToReviewer } from "./handlePurposePublishedWithRiskAnalysisToReviewer.js";
import { handlePurposeQuotaAdjustmentRequestToProducer } from "./handlePurposeQuotaAdjustmentRequestToProducer.js";
import { handlePurposeQuotaAdjustmentResponseToConsumer } from "./handlePurposeQuotaAdjustmentResponseToConsumer.js";
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
          "PurposeRiskAnalysisWorkflowCreated",
          "PurposeRiskAnalysisAssigned",
          "PurposeRiskAnalysisSelfAssigned",
          "PurposeRiskAnalysisSubmitted",
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
