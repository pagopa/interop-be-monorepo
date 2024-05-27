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
  TenantId,
  generateId,
  toClientV2,
} from "pagopa-interop-models";
import { AuthData } from "pagopa-interop-commons";
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

export const getMockAuthData = (organizationId?: TenantId): AuthData => ({
  organizationId: organizationId || generateId(),
  userId: generateId(),
  userRoles: [],
  externalId: {
    value: "123456",
    origin: "IPA",
  },
  selfcareId: generateId(),
});

export const getMockClientWithKey = (): Client => ({
  keys: [
    {
      name: "key name",
      createdAt: new Date(),
      kid: "a kid",
      encodedPem: "",
      algorithm: "",
      use: "Sig",
    },
  ],
  name: "a client",
  id: generateId(),
  createdAt: new Date(),
  consumerId: generateId(),
  kind: "Api",
  purposes: [],
  relationships: [],
  users: [],
});
