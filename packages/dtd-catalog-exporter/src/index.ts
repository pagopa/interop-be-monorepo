import { initFileManager, logger } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  makeDrizzleConnectionWithCleanup,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { dtdCatalogExporterServiceBuilder } from "./services/dtdCatalogExporterService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const { db, cleanup } = makeDrizzleConnectionWithCleanup(config);
const attributeReadModelService = attributeReadModelServiceBuilder(db);
const tenantReadModelService = tenantReadModelServiceBuilder(db);
const readModelServiceSQL = readModelServiceBuilderSQL(
  db,
  attributeReadModelService,
  tenantReadModelService
);

await dtdCatalogExporterServiceBuilder({
  readModelService: readModelServiceSQL,
  fileManager: initFileManager(config),
  loggerInstance: logger({
    serviceName: "dtd-catalog-exporter",
    correlationId: generateId<CorrelationId>(),
  }),
}).exportDtdData();

await cleanup();
