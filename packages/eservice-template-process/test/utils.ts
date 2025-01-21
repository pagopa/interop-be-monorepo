import { setupTestContainersVitest } from "pagopa-interop-commons-test/index.js";
import { inject, afterEach } from "vitest";
import { readModelServiceBuilder } from "../src/services/readModelService.js";
import { eserviceTemplateServiceBuilder } from "../src/services/eserviceTemplateService.js";

export const { cleanup, readModelRepository, postgresDB, fileManager } =
  await setupTestContainersVitest(
    inject("readModelConfig"),
    inject("eventStoreConfig"),
    inject("fileManagerConfig")
  );

afterEach(cleanup);

export const agreements = readModelRepository.agreements;
export const eservices = readModelRepository.eservices;
export const tenants = readModelRepository.tenants;
export const attributes = readModelRepository.attributes;
export const delegations = readModelRepository.delegations;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const catalogService = eserviceTemplateServiceBuilder(
  postgresDB,
  readModelService,
  fileManager
);
