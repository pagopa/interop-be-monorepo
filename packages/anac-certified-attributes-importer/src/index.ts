import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  logger,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { SftpClient } from "./service/sftpService.js";
import { TenantProcessService } from "./service/tenantProcessService.js";
import { importAttributes } from "./service/processor.js";
import { readModelQueriesBuilderSQL } from "./service/readmodelQueriesServiceSQL.js";
import { ReadModelQueries } from "./service/readmodelQueriesService.js";

const sftpClient: SftpClient = new SftpClient(config);
const readModelClient = ReadModelRepository.init(config);
const oldReadModelQueries = new ReadModelQueries(readModelClient);
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

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
const tenantProcess = new TenantProcessService(config.tenantProcessUrl);

const correlationId: CorrelationId = generateId();
const loggerInstance = logger({
  serviceName: "anac-certified-attributes-importer",
  correlationId,
});

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

process.exit(0);
// process.exit() should not be required.
// however, something in this script hangs on exit.
// TODO figure out why and remove this workaround.
