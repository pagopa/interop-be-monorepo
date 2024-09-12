/* eslint-disable functional/no-let */
/* eslint-disable @typescript-eslint/no-non-null-assertion */
import {
  setupTestContainersVitest,
  writeInReadmodel,
} from "pagopa-interop-commons-test";
import { afterEach, inject } from "vitest";
import {
  AgreementCollection,
  AttributeCollection,
  EServiceCollection,
  GenericCollection,
  PurposeCollection,
  TenantCollection,
} from "pagopa-interop-commons";
import { readModelServiceBuilder } from "../src/services/readModelService.js";

export const { cleanup, readModelRepository, postgresDB, fileManager } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    inject("fileManagerConfig")
  );

afterEach(cleanup);

export const agreements: AgreementCollection = readModelRepository.agreements;
export const eservices: EServiceCollection = readModelRepository.eservices;
export const tenants: TenantCollection = readModelRepository.tenants;
export const attributes: AttributeCollection = readModelRepository.attributes;
export const purposes: PurposeCollection = readModelRepository.purposes;

export const readModelService = readModelServiceBuilder(readModelRepository);

export async function seedCollection<T>(
  data: T[],
  collection: GenericCollection<T>
): Promise<void> {
  for (const d of data) {
    await writeInReadmodel(d, collection);
  }
}
