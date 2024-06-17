import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import {
  Client,
  EService,
  clientKind,
  generateId,
  toReadModelEService,
} from "pagopa-interop-models";
import { readModelServiceBuilder } from "../src/readModelService.js";

export const { cleanup, readModelRepository } = setupTestContainersVitest(
  inject("readModelConfig")
);

afterEach(cleanup);

export const eservices = readModelRepository.eservices;
export const clients = readModelRepository.clients;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneClient = async (client: Client): Promise<void> => {
  await writeInReadmodel(client, clients);
};

export const getMockClient = (): Client => ({
  id: generateId(),
  consumerId: generateId(),
  name: "Test client",
  purposes: [],
  description: "Client description",
  users: [],
  kind: clientKind.consumer,
  createdAt: new Date(),
  keys: [],
});
