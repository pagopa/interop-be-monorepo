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

export const eserviceTemplates = readModelRepository.eserviceTemplates;

export const readModelService = readModelServiceBuilder(readModelRepository);

export const eserviceTemplateService = eserviceTemplateServiceBuilder(
  postgresDB,
  readModelService,
  fileManager
);
