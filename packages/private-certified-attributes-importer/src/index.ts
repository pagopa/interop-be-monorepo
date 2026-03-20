import {
  InteropTokenGenerator,
  RefreshableInteropToken,
  getInteropHeaders,
  logger,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  makeDrizzleConnectionWithCleanup,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { importAttributes } from "./service/processor.js";
import { getInteropClients } from "./client/client.js";
import { readModelServiceBuilderSQL } from "./service/readModelService.js";

const { db, cleanup } = makeDrizzleConnectionWithCleanup(config);
const tenantReadModelService = tenantReadModelServiceBuilder(db);
const attributeReadModelService = attributeReadModelServiceBuilder(db);
const readModelQueriesSQL = readModelServiceBuilderSQL({
  readModelDB: db,
  tenantReadModelServiceSQL: tenantReadModelService,
  attributeReadModelServiceSQL: attributeReadModelService,
});

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
const clients = getInteropClients();
const correlationId: CorrelationId = generateId();
const loggerInstance = logger({
  serviceName: "private-certified-attributes-importer",
  correlationId,
});
const token = (await refreshableToken.get()).serialized;
const headers = getInteropHeaders({ token, correlationId });

try {
  loggerInstance.info("Starting private certified attributes importer");

  await importAttributes(
    readModelQueriesSQL,
    clients,
    refreshableToken,
    loggerInstance,
    headers,
    correlationId
  );

  loggerInstance.info("Importer job finished successfully");
} catch (error) {
  loggerInstance.error(`Error during import: ${error}`);
  process.exitCode = 1;
} finally {
  await cleanup();
}
