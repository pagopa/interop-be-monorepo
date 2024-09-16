import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import {
  Client,
  EService,
  toReadModelClient,
  toReadModelEService,
} from "pagopa-interop-models";
import { readModelServiceBuilder } from "../src/readModelService.js";

export const { cleanup, readModelRepository } = await setupTestContainersVitest(
  inject("readModelConfig")
);

afterEach(cleanup);

export const { agreements, clients, eservices, purposes } = readModelRepository;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};

export const addOneClient = async (client: Client): Promise<void> => {
  await writeInReadmodel(toReadModelClient(client), clients);
};
