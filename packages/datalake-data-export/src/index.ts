import { initFileManager, logger } from "pagopa-interop-commons";
import { generateId, CorrelationId } from "pagopa-interop-models";
import { makeDrizzleConnectionWithCleanup } from "pagopa-interop-readmodel";
import { datalakeServiceBuilder } from "./services/datalakeService.js";
import { config } from "./config/config.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const log = logger({
  serviceName: "datalake-data-export",
  correlationId: generateId<CorrelationId>(),
});

const fileManager = initFileManager(config);
const { db: readModelDB, cleanup } = makeDrizzleConnectionWithCleanup(config);
const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);

export const dataLakeService = datalakeServiceBuilder(
  readModelServiceSQL,
  fileManager,
  log
);

log.info("Datalake Data Exporter job started");
await dataLakeService.exportData();
log.info("Done!");

await cleanup();
