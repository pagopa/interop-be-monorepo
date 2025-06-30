/* eslint-disable no-console */
import {
  initFileManager,
  logger,
  ReadModelRepository,
  cleanupResources,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  makeDrizzleConnectionWithCleanup,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { dtdCatalogExporterServiceBuilder } from "./services/dtdCatalogExporterService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const loggerInstance = logger({
  serviceName: "dtd-catalog-exporter",
  correlationId: generateId<CorrelationId>(),
});

const oldReadModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const { connection: db, cleanup: drizzleCleanup } =
  makeDrizzleConnectionWithCleanup(config);
const attributeReadModelService = attributeReadModelServiceBuilder(db);
const tenantReadModelService = tenantReadModelServiceBuilder(db);
const readModelServiceSQL = readModelServiceBuilderSQL(
  db,
  attributeReadModelService,
  tenantReadModelService
);

const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

const fileManager = initFileManager(config);

async function main(): Promise<void> {
  try {
    await dtdCatalogExporterServiceBuilder({
      readModelService,
      fileManager,
      loggerInstance,
    }).exportDtdData();
  } catch (error) {
    loggerInstance.error(error);
  } finally {
    await cleanupResources(loggerInstance, drizzleCleanup);
  }
}

await main();
