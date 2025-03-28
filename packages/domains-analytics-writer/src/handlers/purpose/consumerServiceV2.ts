import { PurposeEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handlePurposeMessageV2(
  message: PurposeEventEnvelopeV2
): Promise<void> {
  await match(message)
    .with(
      {
        type: P.union(
          "DraftPurposeDeleted",
          "WaitingForApprovalPurposeDeleted"
        ),
      },
      async () => Promise.resolve()
    )
    .with(
      {
        type: P.union(
          "PurposeAdded",
          "DraftPurposeUpdated",
          "NewPurposeVersionActivated",
          "NewPurposeVersionWaitingForApproval",
          "PurposeActivated",
          "PurposeArchived",
          "PurposeVersionOverQuotaUnsuspended",
          "PurposeVersionRejected",
          "PurposeVersionSuspendedByConsumer",
          "PurposeVersionSuspendedByProducer",
          "PurposeVersionUnsuspendedByConsumer",
          "PurposeVersionUnsuspendedByProducer",
          "PurposeWaitingForApproval",
          "WaitingForApprovalPurposeVersionDeleted",
          "PurposeVersionActivated",
          "PurposeCloned",
          "PurposeDeletedByRevokedDelegation",
          "PurposeVersionArchivedByRevokedDelegation"
        ),
      },
      async () => Promise.resolve()
    )
    .exhaustive();
}
