import { logger, ReadModelRepository } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  catalogReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { dtdCatalogExporterServiceBuilder } from "./services/dtdCatalogExporterService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const oldReadModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);
const db = makeDrizzleConnection(config);
const attributeReadModelService = attributeReadModelServiceBuilder(db);
const tenantReadModelService = tenantReadModelServiceBuilder(db);
const catalogReadModelService = catalogReadModelServiceBuilder(db);
const readModelServiceSQL = readModelServiceBuilderSQL(
  db,
  attributeReadModelService,
  tenantReadModelService,
  catalogReadModelService
);

const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

await dtdCatalogExporterServiceBuilder({
  readModelService,
  loggerInstance: logger({
    serviceName: "dtd-catalog-exporter",
    correlationId: generateId<CorrelationId>(),
  }),
}).exportDtdData();

process.exit(0);
// process.exit() should not be required.
// however, something in this script hangs on exit.
// TODO figure out why and remove this workaround.
