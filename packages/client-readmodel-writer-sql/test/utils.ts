import {
  getMockClient,
  getMockKey,
  setupTestContainersVitest,
} from "pagopa-interop-commons-test";
import { clientReadModelServiceBuilder } from "pagopa-interop-readmodel";
import { inject, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import {
  WithMetadata,
  Client,
  generateId,
  UserId,
  ClientId,
} from "pagopa-interop-models";
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
import { clientWriterServiceBuilder } from "../src/clientWriterService.js";

export const { cleanup, readModelDB } = await setupTestContainersVitest(
  undefined,
  undefined,
  undefined,
  undefined,
  undefined,
  inject("readModelSQLConfig")
);

afterEach(cleanup);

export const clientReadModelService =
  clientReadModelServiceBuilder(readModelDB);
export const clientWriterService = clientWriterServiceBuilder(readModelDB);

export const getCustomMockClient = ({
  isClientComplete,
}: {
  isClientComplete: boolean;
}): WithMetadata<Client> => ({
  data: getMockClient({
    purposes: [generateId(), generateId()],
    users: [generateId(), generateId()],
    keys: [getMockKey(), getMockKey()],
    ...(isClientComplete
      ? {
          adminId: generateId<UserId>(),
          description: "Client description",
        }
      : {}),
  }),
  metadata: { version: 1 },
});

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
