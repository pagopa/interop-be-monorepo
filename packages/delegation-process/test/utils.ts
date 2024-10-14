import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test/index.js";
import { Delegation } from "pagopa-interop-models";
import { afterEach, inject } from "vitest";
import { delegationServiceBuilder } from "../src/services/delegationService.js";
import { readModelServiceBuilder } from "../src/services/readModelService.js";

export const { cleanup, readModelRepository } = await setupTestContainersVitest(
  inject("readModelConfig")
);
afterEach(cleanup);

export const delegations = readModelRepository.delegations;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const delegationService = delegationServiceBuilder(readModelService);

export const addOneDelegation = async (
  delegation: Delegation
): Promise<void> => {
  await writeInReadmodel(delegation, delegations);
};
