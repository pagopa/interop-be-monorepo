import { match } from "ts-pattern";
import {
  AuthorizationEventEnvelopeV1,
  ClientId,
  makeGSIPKClient,
  makeGSIPKKid,
  makePlatformStatesClientPK,
  unsafeBrandId,
} from "pagopa-interop-models";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  deleteClientEntryFromPlatformStates,
  deleteEntriesFromTokenStatesByClient,
  deleteEntriesFromTokenStatesByKid,
} from "./utils.js";

export async function handleMessageV1(
  message: AuthorizationEventEnvelopeV1,
  dynamoDBClient: DynamoDBClient
): Promise<void> {
  await match(message)
    .with({ type: "KeyDeleted" }, async (msg) => {
      const GSIPK_kid = makeGSIPKKid(msg.data.keyId);
      await deleteEntriesFromTokenStatesByKid(GSIPK_kid, dynamoDBClient);
    })
    .with({ type: "ClientDeleted" }, async (msg) => {
      const clientId = unsafeBrandId<ClientId>(msg.data.clientId);
      const pk = makePlatformStatesClientPK(clientId);
      await deleteClientEntryFromPlatformStates(pk, dynamoDBClient);

      const GSIPK_clientId = makeGSIPKClient(clientId);
      await deleteEntriesFromTokenStatesByClient(
        GSIPK_clientId,
        dynamoDBClient
      );
    })
    .with(
      { type: "ClientAdded" },
      { type: "ClientPurposeAdded" },
      { type: "ClientPurposeRemoved" },
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
