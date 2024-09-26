import { match } from "ts-pattern";
import { PurposeEventEnvelopeV1 } from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export async function handleMessageV1(
  message: PurposeEventEnvelopeV1,
  _dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    // PurposeActivated, NewPurposeVersionActivated, PurposeVersionActivated, PurposeVersionUnsuspendedByConsumer, PurposeVersionUnsuspendedByProducer
    .with({ type: "PurposeVersionActivated" }, async (_msg) =>
      Promise.resolve()
    )
    // PurposeVersionSuspendedByConsumer, PurposeVersionSuspendedByProducer
    .with({ type: "PurposeVersionSuspended" }, async (_msg) =>
      Promise.resolve()
    )
    // PurposeArchived
    .with({ type: "PurposeVersionArchived" }, async (_msg) => Promise.resolve())
    .with(
      { type: "PurposeCreated" },
      { type: "PurposeVersionCreated" },
      { type: "PurposeUpdated" },
      { type: "PurposeVersionWaitedForApproval" },
      { type: "PurposeVersionRejected" },
      { type: "PurposeVersionUpdated" },
      { type: "PurposeDeleted" },
      { type: "PurposeVersionDeleted" },
      () => Promise.resolve()
    )
    .exhaustive();
}
