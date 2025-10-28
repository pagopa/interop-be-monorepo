import {
  PurposeEventEnvelopeV2,
  fromPurposeV2,
  missingKafkaMessageDataError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { PurposeWriterService } from "./purposeWriterService.js";

export async function handleMessageV2(
  message: PurposeEventEnvelopeV2,
  purposeWriterService: PurposeWriterService
): Promise<void> {
  const purposeV2 = message.data.purpose;
  if (!purposeV2) {
    throw missingKafkaMessageDataError("purpose", message.type);
  }
  const purpose = fromPurposeV2(purposeV2);

  await match(message)
    .with(
      { type: "DraftPurposeDeleted" },
      { type: "WaitingForApprovalPurposeDeleted" },
      { type: "PurposeDeletedByRevokedDelegation" },
      async (message) => {
        await purposeWriterService.deletePurposeById(
          unsafeBrandId(message.stream_id),
          message.version
        );
      }
    )
    .with(
      { type: "PurposeAdded" },
      { type: "DraftPurposeUpdated" },
      { type: "NewPurposeVersionActivated" },
      { type: "NewPurposeVersionWaitingForApproval" },
      { type: "PurposeActivated" },
      { type: "PurposeArchived" },
      { type: "PurposeVersionOverQuotaUnsuspended" },
      { type: "PurposeVersionRejected" },
      { type: "PurposeVersionSuspendedByConsumer" },
      { type: "PurposeVersionSuspendedByProducer" },
      { type: "PurposeVersionUnsuspendedByConsumer" },
      { type: "PurposeVersionUnsuspendedByProducer" },
      { type: "PurposeWaitingForApproval" },
      { type: "WaitingForApprovalPurposeVersionDeleted" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeCloned" },
      { type: "PurposeVersionArchivedByRevokedDelegation" },
      { type: "RiskAnalysisDocumentGenerated" },
      async (message) => {
        await purposeWriterService.upsertPurpose(purpose, message.version);
      }
    )
    .exhaustive();
}
