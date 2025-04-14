import { eq } from "drizzle-orm";
import {
  Client,
  ClientId,
  clientKind,
  generateId,
  Key,
  PurposeId,
  UserId,
  WithMetadata,
} from "pagopa-interop-models";
import { getMockKey } from "pagopa-interop-commons-test";
import {
  ClientSQL,
  ClientUserSQL,
  ClientPurposeSQL,
  ClientKeySQL,
  clientInReadmodelClient,
  clientUserInReadmodelClient,
  clientPurposeInReadmodelClient,
  clientKeyInReadmodelClient,
} from "pagopa-interop-readmodel-models";
import { clientReadModelServiceBuilder } from "../src/clientReadModelService.js";
import { readModelDB } from "./utils.js";

export const clientReadModelService =
  clientReadModelServiceBuilder(readModelDB);

export const getCustomMockClient = ({
  isClientComplete,
}: {
  isClientComplete: boolean;
}): WithMetadata<Client> => {
  const purposes: PurposeId[] = [
    generateId<PurposeId>(),
    generateId<PurposeId>(),
  ];
  const users: UserId[] = [generateId<UserId>(), generateId<UserId>()];
  const keys: Key[] = [getMockKey(), getMockKey()];
  const client: Client = {
    id: generateId(),
    consumerId: generateId(),
    name: "Test client",
    purposes,
    ...(isClientComplete
      ? {
          description: "Client description",
        }
      : {}),
    users,
    kind: clientKind.consumer,
    createdAt: new Date(),
    keys,
  };
  return {
    data: client,
    metadata: { version: 1 },
  };
};

export const retrievedClientSQLObjects = async (
  client: WithMetadata<Client>
): Promise<{
  clientSQL: ClientSQL;
  usersSQL: ClientUserSQL[];
  purposesSQL: ClientPurposeSQL[];
  keysSQL: ClientKeySQL[];
}> => {
  const clientSQL = await retrieveClientSQLByClientId(client.data.id);
  const usersSQL = await retrieveUsersSQLByClientId(client.data.id);
  const purposesSQL = await retrievePurposesSQLByClientId(client.data.id);
  const keysSQL = await retrieveKeysSQLByClientId(client.data.id);

  return { clientSQL, usersSQL, purposesSQL, keysSQL };
};

const retrieveClientSQLByClientId = async (
  clientId: ClientId
): Promise<ClientSQL> => {
  const clients = await readModelDB
    .select()
    .from(clientInReadmodelClient)
    .where(eq(clientInReadmodelClient.id, clientId));
  return clients[0];
};

const retrieveUsersSQLByClientId = async (
  clientId: ClientId
): Promise<ClientUserSQL[]> =>
  await readModelDB
    .select()
    .from(clientUserInReadmodelClient)
    .where(eq(clientUserInReadmodelClient.clientId, clientId));

const retrievePurposesSQLByClientId = async (
  clientId: ClientId
): Promise<ClientPurposeSQL[]> =>
  await readModelDB
    .select()
    .from(clientPurposeInReadmodelClient)
    .where(eq(clientPurposeInReadmodelClient.clientId, clientId));

const retrieveKeysSQLByClientId = async (
  clientId: ClientId
): Promise<ClientKeySQL[]> =>
  await readModelDB
    .select()
    .from(clientKeyInReadmodelClient)
    .where(eq(clientKeyInReadmodelClient.clientId, clientId));
