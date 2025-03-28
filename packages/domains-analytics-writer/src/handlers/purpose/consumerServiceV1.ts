import { PurposeEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handlePurposeMessageV1(
  message: PurposeEventEnvelopeV1
): Promise<void> {
  await match(message)
    .with(
      { type: P.union("PurposeCreated", "PurposeVersionCreated") },
      async () => Promise.resolve()
    )
    .with(
      {
        type: P.union(
          "PurposeUpdated",
          "PurposeVersionActivated",
          "PurposeVersionSuspended",
          "PurposeVersionArchived",
          "PurposeVersionWaitedForApproval",
          "PurposeVersionRejected"
        ),
      },
      async () => Promise.resolve()
    )
    .with({ type: "PurposeVersionUpdated" }, async () => Promise.resolve())
    .with({ type: "PurposeDeleted" }, async () => Promise.resolve())
    .with({ type: "PurposeVersionDeleted" }, async () => Promise.resolve())
    .exhaustive();
}
