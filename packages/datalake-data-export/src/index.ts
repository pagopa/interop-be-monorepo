import { initFileManager, logger } from "pagopa-interop-commons";
import { generateId, CorrelationId } from "pagopa-interop-models";
import { makeDrizzleConnection } from "pagopa-interop-readmodel";
import { datalakeServiceBuilder } from "./services/datalakeService.js";
import { config } from "./config/config.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const log = logger({
  serviceName: "datalake-data-export",
  correlationId: generateId<CorrelationId>(),
});

const fileManager = initFileManager(config);
const readModelDB = makeDrizzleConnection(config);
const readModelServiceSQL = readModelServiceBuilderSQL(readModelDB);

export const dataLakeService = datalakeServiceBuilder(
  readModelServiceSQL,
  fileManager,
  log
);

log.info("Datalake Data Exporter job started");
await dataLakeService.exportData();
log.info("Done!");

process.exit(0);
// process.exit() should not be required.
// however, something in this script hangs on exit.
// TODO figure out why and remove this workaround.
