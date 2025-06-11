import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  logger,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  makeDrizzleConnectionWithCleanup,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { SftpClient } from "./service/sftpService.js";
import { TenantProcessService } from "./service/tenantProcessService.js";
import { importAttributes } from "./service/processor.js";
import { readModelQueriesBuilderSQL } from "./service/readmodelQueriesServiceSQL.js";
import { readModelQueriesBuilder } from "./service/readmodelQueriesService.js";

const sftpClient: SftpClient = new SftpClient(config);
const readModelClient = ReadModelRepository.init(config);
const oldReadModelQueries = readModelQueriesBuilder(readModelClient);
const { connection: db, cleanup: drizzleCleanup } =
  makeDrizzleConnectionWithCleanup(config);
const tenantReadModelService = tenantReadModelServiceBuilder(db);
const attributeReadModelService = attributeReadModelServiceBuilder(db);
const readModelQueriesSQL = readModelQueriesBuilderSQL(
  db,
  tenantReadModelService,
  attributeReadModelService
);

const readModelQueries =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelQueriesSQL
    : oldReadModelQueries;

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
const tenantProcess = new TenantProcessService(config.tenantProcessUrl);

const correlationId: CorrelationId = generateId();
const loggerInstance = logger({
  serviceName: "anac-certified-attributes-importer",
  correlationId,
});

async function main(): Promise<void> {
  try {
    await importAttributes(
      sftpClient,
      readModelQueries,
      tenantProcess,
      refreshableToken,
      config.recordsProcessBatchSize,
      config.anacTenantId,
      loggerInstance,
      correlationId
    );
  } catch (error) {
    loggerInstance.error(error);
  } finally {
    // Clean up resources that prevent process exit
    loggerInstance.info("Cleaning up resources...");

    // Close MongoDB connections
    await ReadModelRepository.cleanup();

    // Close PostgreSQL pool connections
    await drizzleCleanup();

    loggerInstance.info("Cleanup completed!");
  }
}

await main();
