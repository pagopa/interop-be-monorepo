import { PurposeEventEnvelopeV2 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handlePurposeMessageV2(
  message: PurposeEventEnvelopeV2
): Promise<void> {
  await match(message)
    .with(
      P.union(
        { type: "DraftPurposeDeleted" },
        { type: "WaitingForApprovalPurposeDeleted" }
      ),
      async () => Promise.resolve()
    )
    .with(
      P.union(
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
        { type: "PurposeDeletedByRevokedDelegation" },
        { type: "PurposeVersionArchivedByRevokedDelegation" }
      ),
      async () => Promise.resolve()
    )
    .exhaustive();
}
