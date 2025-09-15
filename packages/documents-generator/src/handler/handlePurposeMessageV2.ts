import { PurposeEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { FileManager, Logger, PDFGenerator } from "pagopa-interop-commons";
import { ReadModelService } from "../service/readModelService.js";

export async function handlePurposeMessageV2(
  decodedMessage: PurposeEventEnvelopeV2,
  pdfGenerator: PDFGenerator,
  fileManager: FileManager,
  readModelService: ReadModelService,
  logger: Logger
): Promise<void> {
  await match(decodedMessage)
    .with(
      {
        type: P.union(
          "PurposeActivated",
          "NewPurposeVersionActivated",
          "PurposeVersionActivated"
        ),
      },
      async (msg): Promise<void> => {
        logger.info(`purpose event ${msg.type} handled successfully`);
      }
    )
    .with(
      {
        type: P.union(
          "PurposeAdded",
          "DraftPurposeUpdated",
          "WaitingForApprovalPurposeVersionDeleted",
          "NewPurposeVersionWaitingForApproval",
          "PurposeCloned",
          "PurposeVersionRejected",
          "PurposeWaitingForApproval",
          "DraftPurposeDeleted",
          "WaitingForApprovalPurposeDeleted",
          "PurposeDeletedByRevokedDelegation",
          "PurposeVersionSuspendedByConsumer",
          "PurposeVersionSuspendedByProducer",
          "PurposeVersionUnsuspendedByConsumer",
          "PurposeVersionUnsuspendedByProducer",
          "PurposeVersionOverQuotaUnsuspended",
          "PurposeArchived",
          "PurposeVersionArchivedByRevokedDelegation"
        ),
      },
      () => {
        logger.info(
          `No document generation needed for ${decodedMessage.type} message`
        );
      }
    )
    .exhaustive();
}
