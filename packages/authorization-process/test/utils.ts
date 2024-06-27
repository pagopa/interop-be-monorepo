import {
  ReadEvent,
  StoredEvent,
  setupTestContainersVitest,
  writeInEventstore,
  writeInReadmodel,
  readLastEventByStreamId,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  AuthorizationEvent,
  Client,
  ClientId,
  toClientV2,
} from "pagopa-interop-models";
import { SelfcareV2Client } from "pagopa-interop-selfcare-v2-client";
import { toReadModelClient } from "pagopa-interop-models";
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
export const selfcareV2Client: SelfcareV2Client = {} as SelfcareV2Client;

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

export const readLastAuthorizationEvent = async (
  clientId: ClientId
): Promise<ReadEvent<AuthorizationEvent>> =>
  await readLastEventByStreamId(clientId, '"authorization"', postgresDB);
