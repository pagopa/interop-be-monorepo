import {
  InteropTokenGenerator,
  RefreshableInteropToken,
  logger,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import { makeDrizzleConnectionWithCleanup } from "pagopa-interop-readmodel";

import { config } from "./config/config.js";
import { catalogProcessClientBuilder } from "./services/catalogProcessClient.js";
import { eserviceDescriptorsScheduledArchiverServiceBuilder } from "./services/eserviceDescriptorsScheduledArchiverService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const { db, cleanup } = makeDrizzleConnectionWithCleanup(config);
const readModelServiceSQL = readModelServiceBuilderSQL(db);
const loggerInstance = logger({
  serviceName: "eservice-descriptors-scheduled-archiver",
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
  const archiverService = eserviceDescriptorsScheduledArchiverServiceBuilder({
    readModelService: readModelServiceSQL,
    catalogProcessClient: catalogProcessClientBuilder(config.catalogProcessUrl),
    loggerInstance,
    refreshableToken,
  });
  const descriptorSuccess = await archiverService.archiveDescriptors();
  const eserviceSuccess = await archiverService.archiveEServices();
  const exitCode = descriptorSuccess && eserviceSuccess ? 0 : 1;
  await processExit(exitCode);
} catch (error) {
  loggerInstance.error(
    `Error handling eservice-descriptors-scheduled-archiver: ${error}`
  );
  await processExit(255);
}
