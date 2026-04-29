import { logger } from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { makeDrizzleConnectionWithCleanup } from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { eserviceDescriptorsArchiverSchedulerServiceBuilder } from "./services/eserviceDescriptorsArchiverSchedulerService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { catalogProcessClientBuilder } from "./services/catalogProcessClient.js";

const { db, cleanup } = makeDrizzleConnectionWithCleanup(config);
const readModelServiceSQL = readModelServiceBuilderSQL(db);

try {
  await eserviceDescriptorsArchiverSchedulerServiceBuilder({
    readModelService: readModelServiceSQL,
    catalogProcessClient: catalogProcessClientBuilder(config.catalogProcessUrl),
    loggerInstance: logger({
      serviceName: "eservice-descriptors-archiver-scheduler",
      correlationId: generateId<CorrelationId>(),
    }),
  })();
} finally {
  await cleanup();
}
