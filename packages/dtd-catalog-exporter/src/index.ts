import { logger, ReadModelRepository } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { config } from "./config/config.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { dtdCatalogExporterServiceBuilder } from "./services/dtdCatalogExporterService.js";

await dtdCatalogExporterServiceBuilder({
  readModelService: readModelServiceBuilder(ReadModelRepository.init(config)),
  loggerInstance: logger({
    serviceName: "dtd-catalog-exporter",
    correlationId: generateId<CorrelationId>(),
  }),
}).exportDtdData();

process.exit(0);
// process.exit() should not be required.
// however, something in this script hangs on exit.
// TODO figure out why and remove this workaround.
