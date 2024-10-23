import {
  ReadEvent,
  StoredEvent,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
  readLastEventByStreamId,
  createMockedApiRequester,
  createJwtToken,
} from "pagopa-interop-commons-test";
import { afterEach, inject, vi } from "vitest";
import {
  AuthorizationEvent,
  Client,
  ClientId,
  ProducerKeychain,
  ProducerKeychainId,
  toClientV2,
  toProducerKeychainV2,
  toReadModelClient,
  toReadModelProducerKeychain,
} from "pagopa-interop-models";
import {
  authorizationApi,
  SelfcareV2InstitutionClient,
} from "pagopa-interop-api-clients";
import { ZodiosRouterContextRequestHandler } from "@zodios/express";
import {
  ExpressContext,
  // jwtFromAuthHeader,
  genericLogger,
  AuthData,
  readAuthDataFromJwtToken,
} from "pagopa-interop-commons";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { authorizationServiceBuilder } from "../src/services/authorizationService.js";

export const { cleanup, readModelRepository, postgresDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig")
  );

afterEach(cleanup);

export const {
  agreements,
  clients,
  eservices,
  keys,
  purposes,
  tenants,
  producerKeychains,
} = readModelRepository;

export const readModelService = readModelServiceBuilder(readModelRepository);
export const selfcareV2Client: SelfcareV2InstitutionClient =
  {} as SelfcareV2InstitutionClient;

export const authorizationService = authorizationServiceBuilder(
  postgresDB,
  readModelService,
  selfcareV2Client
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
  await writeInReadmodel(toReadModelClient(client), clients);
};

export const writeProducerKeychainInEventstore = async (
  producerKeychain: ProducerKeychain
): Promise<void> => {
  const authorizationtEvent: AuthorizationEvent = {
    type: "ProducerKeychainAdded",
    event_version: 2,
    data: { producerKeychain: toProducerKeychainV2(producerKeychain) },
  };
  const eventToWrite: StoredEvent<AuthorizationEvent> = {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    stream_id: authorizationtEvent.data.producerKeychain!.id,
    version: 0,
    event: authorizationtEvent,
  };

  await writeInEventstore(eventToWrite, '"authorization"', postgresDB);
};

export const addOneProducerKeychain = async (
  producerKeychain: ProducerKeychain
): Promise<void> => {
  await writeProducerKeychainInEventstore(producerKeychain);
  await writeInReadmodel(
    toReadModelProducerKeychain(producerKeychain),
    producerKeychains
  );
};

export const readLastAuthorizationEvent = async (
  id: ClientId | ProducerKeychainId
): Promise<ReadEvent<AuthorizationEvent>> =>
  await readLastEventByStreamId(id, '"authorization"', postgresDB);

export function getAuthDataAndToken(): [string, AuthData] {
  const newJwtToken = createJwtToken();
  const authData: AuthData = readAuthDataFromJwtToken(
    newJwtToken,
    genericLogger
  );
  return [newJwtToken, authData];
}

vi.mock("pagopa-interop-commons", async (importActual) => {
  const authenticationMiddleware: (
    config: unknown
  ) => ZodiosRouterContextRequestHandler<ExpressContext> =
    () =>
    async (req, _res, next): Promise<unknown> => {
      console.log("Middleware attivato");
      try {
        const [newJwtToken, authData] = getAuthDataAndToken();
        req.ctx.authData = authData;
        req.headers.authorization = `Bearer ${newJwtToken}`;
        return next();
      } catch (error) {
        next(error);
      }
      return next();
    };
  const actual = await importActual<typeof import("pagopa-interop-commons")>();
  return {
    ...actual,
    authenticationMiddleware,
  };
});

vi.mock("../src/config/config.js", async (importActual) => {
  const actual = await importActual<typeof import("../src/config/config.js")>();
  return {
    ...actual,
    ...inject("readModelConfig"),
    ...inject("eventStoreConfig"),
  };
});

const { default: app } = await import("../src/app.js");

export const mockClientRouterRequest =
  createMockedApiRequester<typeof authorizationApi.clientEndpoints>(app);
