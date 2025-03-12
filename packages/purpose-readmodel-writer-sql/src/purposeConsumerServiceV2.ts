import {
  PurposeEventEnvelopeV2,
  fromPurposeV2,
  genericInternalError,
  unsafeBrandId,
} from "pagopa-interop-models";
import { match } from "ts-pattern";
import { CustomReadModelService } from "./readModelService.js";

export async function handleMessageV2(
  message: PurposeEventEnvelopeV2,
  purposeReadModelService: CustomReadModelService
): Promise<void> {
  const purposeV2 = message.data.purpose;
  if (!purposeV2) {
    throw genericInternalError("Purpose can't be missing in the event message");
  }
  const purpose = fromPurposeV2(purposeV2);

  await match(message)
    .with(
      { type: "DraftPurposeDeleted" },
      { type: "WaitingForApprovalPurposeDeleted" },
      { type: "PurposeDeletedByRevokedDelegation" },
      async (message) => {
        await purposeReadModelService.deletePurposeById(
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
      async (message) => {
        await purposeReadModelService.upsertPurpose(purpose, message.version);
      }
    )
    .exhaustive();
}
