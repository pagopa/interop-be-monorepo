import {
  initFileManager,
  logger,
  ReadModelRepository,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { config } from "./config/config.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { dtdCatalogExporterServiceBuilder } from "./services/dtdCatalogExporterService.js";

await dtdCatalogExporterServiceBuilder({
  readModelService: readModelServiceBuilder(ReadModelRepository.init(config)),
  fileManager: initFileManager(config),
  loggerInstance: logger({
    serviceName: "dtd-catalog-exporter",
    correlationId: generateId<CorrelationId>(),
  }),
}).exportDtdPublicCatalog();
