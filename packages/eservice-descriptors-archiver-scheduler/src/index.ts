import {
  InteropTokenGenerator,
  RefreshableInteropToken,
  logger,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { makeDrizzleConnectionWithCleanup } from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { eserviceDescriptorsArchiverSchedulerServiceBuilder } from "./services/eserviceDescriptorsArchiverSchedulerService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { catalogProcessClientBuilder } from "./services/catalogProcessClient.js";

const { db, cleanup } = makeDrizzleConnectionWithCleanup(config);
const readModelServiceSQL = readModelServiceBuilderSQL(db);
const loggerInstance = logger({
  serviceName: "eservice-descriptors-archiver-scheduler",
  correlationId: generateId<CorrelationId>(),
});

const processExit = async (exitCode: number) => {
  await cleanup();
  process.exit(exitCode);
};

try {
  const tokenGenerator = new InteropTokenGenerator(config);
  const refreshableToken = new RefreshableInteropToken(tokenGenerator);
  await refreshableToken.init();
  const archiverService = eserviceDescriptorsArchiverSchedulerServiceBuilder({
    readModelService: readModelServiceSQL,
    catalogProcessClient: catalogProcessClientBuilder(config.catalogProcessUrl),
    loggerInstance,
    refreshableToken,
  });
  await archiverService.archiveDescriptors();
  await archiverService.archiveEServices();
  await processExit(0);
} catch (error) {
  loggerInstance.error(
    `Error handling EService Descriptors Archiver Scheduler: ${error}`
  );
  processExit(1);
}
