import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { inject, afterEach } from "vitest";
import { EService, toReadModelEService } from "pagopa-interop-models";
import { readModelServiceBuilder } from "../src/readModelService.js";

export const { cleanup, readModelRepository } = setupTestContainersVitest(
  inject("readModelConfig")
);

afterEach(cleanup);

export const eservices = readModelRepository.eservices;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const addOneEService = async (eservice: EService): Promise<void> => {
  await writeInReadmodel(toReadModelEService(eservice), eservices);
};
