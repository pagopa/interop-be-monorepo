import { PurposeEventEnvelopeV1 } from "pagopa-interop-models";
import { match, P } from "ts-pattern";

export async function handlePurposeMessageV1(
  message: PurposeEventEnvelopeV1
): Promise<void> {
  await match(message)
    .with(
      P.union(
        { type: "PurposeCreated" },
        { type: "PurposeVersionCreated" },
        { type: "PurposeVersionUpdated" },
        { type: "PurposeDeleted" },
        { type: "PurposeVersionDeleted" }
      ),
      async () => Promise.resolve()
    )
    .with(
      P.union(
        { type: "PurposeUpdated" },
        { type: "PurposeVersionActivated" },
        { type: "PurposeVersionSuspended" },
        { type: "PurposeVersionArchived" },
        { type: "PurposeVersionWaitedForApproval" },
        { type: "PurposeVersionRejected" }
      ),
      async () => Promise.resolve()
    )
    .exhaustive();
}
