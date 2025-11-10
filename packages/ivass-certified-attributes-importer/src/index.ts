import {
  InteropTokenGenerator,
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

await importAttributes(
  csvDownloader,
  readModelQueriesSQL,
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
