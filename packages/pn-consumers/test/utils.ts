import { GenericCollection } from "pagopa-interop-commons";
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import { readModelServiceBuilder } from "../src/services/readModelService.js";

export const { cleanup, readModelRepository, postgresDB } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig")
  );

afterEach(cleanup);

export const { purposes, tenants } = readModelRepository;

export const readModelService = readModelServiceBuilder(readModelRepository);

export async function seedCollection<T>(
  collection: GenericCollection<T>,
  data: T[]
): Promise<void> {
  for (const d of data) {
    await writeInReadmodel(d, collection);
  }
}
