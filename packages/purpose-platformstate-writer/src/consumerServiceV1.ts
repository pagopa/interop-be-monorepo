import { match } from "ts-pattern";
import { PurposeEventEnvelopeV1 } from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export async function handleMessageV1(
  message: PurposeEventEnvelopeV1,
  _dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "PurposeCreated" }, async (_msg) => Promise.resolve())
    .with({ type: "PurposeVersionCreated" }, async (_msg) => Promise.resolve())
    .with(
      { type: "PurposeVersionActivated" },
      { type: "PurposeVersionSuspended" },
      async (_msg) => Promise.resolve()
    )
    .with({ type: "PurposeVersionArchived" }, async (_msg) => Promise.resolve())
    .with(
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
