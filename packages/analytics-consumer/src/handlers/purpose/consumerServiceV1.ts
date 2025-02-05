import { PurposeEventEnvelopeV1 } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handlePurposeMessageV1(
  message: PurposeEventEnvelopeV1
): Promise<void> {
  await match(message)
    .with({ type: "PurposeCreated" }, async () => Promise.resolve())
    .with({ type: "PurposeVersionCreated" }, async () => Promise.resolve())
    .with(
      { type: "PurposeUpdated" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeVersionSuspended" },
      { type: "PurposeVersionArchived" },
      { type: "PurposeVersionWaitedForApproval" },
      { type: "PurposeVersionRejected" },
      async () => Promise.resolve()
    )
    .with({ type: "PurposeVersionUpdated" }, async () => Promise.resolve())
    .with({ type: "PurposeDeleted" }, async () => Promise.resolve())
    .with({ type: "PurposeVersionDeleted" }, async () => Promise.resolve())
    .exhaustive();
}
