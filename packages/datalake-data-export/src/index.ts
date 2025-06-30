import {
  initFileManager,
  logger,
  ReadModelRepository,
  cleanupResources,
} from "pagopa-interop-commons";
import { generateId, CorrelationId } from "pagopa-interop-models";
import { makeDrizzleConnectionWithCleanup } from "pagopa-interop-readmodel";
import { datalakeServiceBuilder } from "./services/datalakeService.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { config } from "./config/config.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const loggerInstance = logger({
  serviceName: "datalake-data-export",
  correlationId: generateId<CorrelationId>(),
});

const fileManager = initFileManager(config);
const oldReadModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const { connection: readModelDB, cleanup: drizzleCleanup } =
  makeDrizzleConnectionWithCleanup(config);
const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);
const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

export const dataLakeService = datalakeServiceBuilder(
  readModelService,
  fileManager,
  loggerInstance
);

async function main(): Promise<void> {
  try {
    loggerInstance.info("Datalake Data Exporter job started");
    await dataLakeService.exportData();
    loggerInstance.info("Done!");
  } catch (error) {
    loggerInstance.error(error);
  } finally {
    await cleanupResources(loggerInstance, drizzleCleanup);
  }
}

await main();
