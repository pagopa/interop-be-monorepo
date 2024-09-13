import { match } from "ts-pattern";
import { PurposeEventEnvelopeV1 } from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export async function handleMessageV1(
  message: PurposeEventEnvelopeV1,
  _dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with(
      { type: "PurposeCreated" },
      { type: "PurposeVersionCreated" },
      { type: "PurposeUpdated" },
      { type: "PurposeVersionActivated" },
      { type: "PurposeVersionSuspended" },
      { type: "PurposeVersionArchived" },
      { type: "PurposeVersionWaitedForApproval" },
      { type: "PurposeVersionRejected" },
      { type: "PurposeVersionUpdated" },
      { type: "PurposeDeleted" },
      { type: "PurposeVersionDeleted" },
      () => Promise.resolve()
    )
    .exhaustive();
}
