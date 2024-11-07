import { match } from "ts-pattern";
import { AuthorizationEventEnvelopeV1 } from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";

export async function handleMessageV1(
  message: AuthorizationEventEnvelopeV1,
  _dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with(
      { type: "ClientAdded" },
      { type: "ClientDeleted" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
      { type: "KeyDeleted" },
      { type: "KeyRelationshipToUserMigrated" },
      { type: "KeysAdded" },
      { type: "RelationshipAdded" },
      { type: "RelationshipAdded" },
      { type: "RelationshipRemoved" },
      { type: "UserAdded" },
      { type: "UserRemoved" },
      async () => Promise.resolve()
    )
    .exhaustive();
}
