import {
  initFileManager,
  logger,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { datalakeServiceBuilder } from "./services/datalakeService.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { config } from "./config/config.js";

const log = logger({
  serviceName: "datalake-data-export",
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