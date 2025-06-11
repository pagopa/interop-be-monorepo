import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  initFileManager,
  logger,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  makeDrizzleConnectionWithCleanup,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { TenantProcessService } from "./service/tenantProcessService.js";
import { importAttributes } from "./service/processor.js";
import { downloadCSV } from "./service/fileDownloader.js";
import {
  ReadModelQueries,
  readModelQueriesBuilder,
} from "./service/readModelQueriesService.js";
import { readModelQueriesBuilderSQL } from "./service/readModelQueriesServiceSQL.js";

const correlationId = generateId<CorrelationId>();
const loggerInstance = logger({
  serviceName: "ivass-certified-attributes-importer",
  correlationId,
});

const fileManager = initFileManager(config);

const csvDownloader = (): Promise<string> =>
  downloadCSV(
    config.sourceUrl,
    fileManager,
    config.historyBucketName,
    loggerInstance
  );

const readModelClient = ReadModelRepository.init(config);
const oldReadModelQueries: ReadModelQueries =
  readModelQueriesBuilder(readModelClient);

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
const tenantProcess = new TenantProcessService(config.tenantProcessUrl);

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

async function main(): Promise<void> {
  try {
    await importAttributes(
      csvDownloader,
      readModelQueries,
      tenantProcess,
      refreshableToken,
      config.recordsProcessBatchSize,
      config.ivassTenantId,
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
