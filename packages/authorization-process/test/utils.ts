import {
  StoredEvent,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import { afterEach, inject } from "vitest";
import {
  AuthorizationEvent,
  Client,
  generateId,
  toClientV2,
} from "pagopa-interop-models";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { authorizationServiceBuilder } from "../src/services/authorizationService.js";
export const { cleanup, readModelRepository, postgresDB } =
  setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig")
  );

afterEach(cleanup);

export const clients = readModelRepository.clients;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const authorizationService = authorizationServiceBuilder(
  postgresDB,
  readModelService
);

export const writeClientInEventstore = async (
  client: Client
): Promise<void> => {
  const authorizationtEvent: AuthorizationEvent = {
    type: "ClientAdded",
    event_version: 2,
    data: { client: toClientV2(client) },
  };
  const eventToWrite: StoredEvent<AuthorizationEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: authorizationtEvent.data.client!.id,
    version: 0,
    event: authorizationtEvent,
  };

  await writeInEventstore(eventToWrite, '"authorization"', postgresDB);
};

export const addOneClient = async (client: Client): Promise<void> => {
  await writeClientInEventstore(client);
  await writeInReadmodel(client, clients);
};

export const getMockClient = (): Client => ({
  keys: [],
  name: "a client",
  id: generateId(),
  createdAt: new Date(),
  consumerId: generateId(),
  kind: "Api",
  purposes: [],
  relationships: [],
  users: [],
});
