import {
  initFileManager,
  logger,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { generateId, CorrelationId } from "pagopa-interop-models";
import {
  agreementReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { datalakeServiceBuilder } from "./services/datalakeService.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { config } from "./config/config.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const log = logger({
  serviceName: "datalake-data-export",
  correlationId: generateId<CorrelationId>(),
});

const fileManager = initFileManager(config);
const oldReadModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const readModelDB = makeDrizzleConnection(config);
const agreementReadModelServiceSQL =
  agreementReadModelServiceBuilder(readModelDB);
const catalogReadModelServiceSQL = catalogReadModelServiceBuilder(readModelDB);
const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
const readModelServiceSQL = readModelServiceBuilderSQL({
  readModelDB,
  agreementReadModelServiceSQL,
  catalogReadModelServiceSQL,
  tenantReadModelServiceSQL,
});
const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

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
