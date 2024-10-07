import crypto from "crypto";
import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  initFileManager,
  logger,
} from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { TenantProcessService } from "./service/tenantProcessService.js";
import { importAttributes } from "./service/processor.js";
import { downloadCSV } from "./service/fileDownloader.js";
import { ReadModelQueries } from "./service/readModelQueriesService.js";

const loggerInstance = logger({
  serviceName: "ivass-certified-attributes-importer",
  correlationId: crypto.randomUUID(),
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
const readModelQueries: ReadModelQueries = new ReadModelQueries(
  readModelClient
);

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
const tenantProcess = new TenantProcessService(config.tenantProcessUrl);

await importAttributes(
  csvDownloader,
  readModelQueries,
  tenantProcess,
  refreshableToken,
  config.recordsProcessBatchSize,
  config.ivassTenantId,
  loggerInstance
);
