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
  makeDrizzleConnection,
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
import { readModelQueriesBuilderSQL } from "./service/readmodelQueriesServiceSQL.js";

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

const db = makeDrizzleConnection(config);
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

process.exit(0);
// process.exit() should not be required.
// however, something in this script hangs on exit.
// TODO figure out why and remove this workaround.
