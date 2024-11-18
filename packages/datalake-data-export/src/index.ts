import {
  initFileManager,
  logger,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { generateId, CorrelationId } from "pagopa-interop-models";
import { datalakeServiceBuilder } from "./services/datalakeService.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { config } from "./config/config.js";

const log = logger({
  serviceName: "datalake-data-export",
  correlationId: generateId<CorrelationId>(),
});

const fileManager = initFileManager(config);
const readModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

export const dataLakeService = datalakeServiceBuilder(
  readModelService,
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