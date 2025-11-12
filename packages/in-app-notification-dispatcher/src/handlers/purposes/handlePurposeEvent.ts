import { PurposeEventEnvelopeV2, NewNotification } from "pagopa-interop-models";
import { Logger } from "pagopa-interop-commons";
import { P, match } from "ts-pattern";
import { ReadModelServiceSQL } from "../../services/readModelServiceSQL.js";
import { handlePurposeStatusChangedToProducer } from "./handlePurposeStatusChangedToProducer.js";
import { handlePurposeSuspendedUnsuspendedToConsumer } from "./handlePurposeSuspendedUnsuspendedToConsumer.js";
import { handlePurposeActivatedRejectedToConsumer } from "./handlePurposeActivatedRejectedToConsumer.js";
import { handlePurposeQuotaAdjustmentRequestToProducer } from "./handlePurposeQuotaAdjustmentRequestToProducer.js";
import { handlePurposeOverQuotaToConsumer } from "./handlePurposeOverQuotaToConsumer.js";
import { handlePurposeQuotaAdjustmentResponseToConsumer } from "./handlePurposeQuotaAdjustmentResponseToConsumer.js";

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
          "RiskAnalysisDocumentGenerated"
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
