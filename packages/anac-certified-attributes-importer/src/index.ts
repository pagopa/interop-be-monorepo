import crypto from "crypto";
import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  logger,
} from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { SftpClient } from "./service/sftpService.js";
import { ReadModelQueries } from "./service/readmodelQueriesService.js";
import { TenantProcessService } from "./service/tenantProcessService.js";
import { importAttributes } from "./service/processor.js";

const sftpClient: SftpClient = new SftpClient(config);
const readModelClient = ReadModelRepository.init(config);
const readModelQueries: ReadModelQueries = new ReadModelQueries(
  readModelClient
);

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
const tenantProcess = new TenantProcessService(config.tenantProcessUrl);

const loggerInstance = logger({
  serviceName: "anac-certified-attributes-importer",
  correlationId: crypto.randomUUID(),
});

await importAttributes(
  sftpClient,
  readModelQueries,
  tenantProcess,
  refreshableToken,
  config.recordsProcessBatchSize,
  config.anacTenantId,
  loggerInstance
);
