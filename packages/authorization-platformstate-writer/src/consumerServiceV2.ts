import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { AuthorizationEventEnvelopeV2 } from "pagopa-interop-models";
import { match } from "ts-pattern";

export async function handleMessageV2(
  message: AuthorizationEventEnvelopeV2,
  _dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with(
      { type: "ClientAdded" },
      { type: "ClientDeleted" },
      { type: "ClientKeyAdded" },
      { type: "ClientKeyDeleted" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
      { type: "ClientUserAdded" },
      { type: "ClientUserDeleted" },
      { type: "ProducerKeychainAdded" },
      { type: "ProducerKeychainDeleted" },
      { type: "ProducerKeychainEServiceAdded" },
      { type: "ProducerKeychainEServiceRemoved" },
      { type: "ProducerKeychainEServiceAdded" },
      { type: "ProducerKeychainEServiceRemoved" },
      { type: "ProducerKeychainKeyAdded" },
      { type: "ProducerKeychainKeyDeleted" },
      { type: "ProducerKeychainUserAdded" },
      { type: "ProducerKeychainUserDeleted" },
      () => Promise.resolve()
    )
    .exhaustive();
}
