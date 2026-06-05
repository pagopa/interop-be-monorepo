import {
  InteropTokenGenerator,
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
import { TenantProcessService } from "./service/tenantProcessService.js";
import { AttributeProcessService } from "./service/attributeProcessService.js";
import { importAttributes } from "./service/processor.js";
import { readModelQueriesBuilderSQL } from "./service/readModelServiceSQL.js";
import { IstatClient } from "./service/istatClient.js";
import { attributeRegistryApi } from "pagopa-interop-api-clients";

const istatClient = new IstatClient(config.istatDownloadUrl);
const { db, cleanup } = makeDrizzleConnectionWithCleanup(config);
const tenantReadModelService = tenantReadModelServiceBuilder(db);
const attributeReadModelService = attributeReadModelServiceBuilder(db);
const readModelQueriesSQL = readModelQueriesBuilderSQL(
  db,
  tenantReadModelService,
  attributeReadModelService
);

const tokenGenerator = new InteropTokenGenerator(config);
const refreshableToken = new RefreshableInteropToken(tokenGenerator);
const tenantProcess = new TenantProcessService(config.tenantProcessUrl);
const attributeRegistryClient = attributeRegistryApi.createAttributeApiClient(
  config.attributeProcessUrl
);

const attributeProcess = new AttributeProcessService(attributeRegistryClient);

const correlationId: CorrelationId = generateId();
const loggerInstance = logger({
  serviceName: "istat-certified-discrete-attributes-importer",
  correlationId,
});

try {
  await importAttributes(
    istatClient,
    readModelQueriesSQL,
    tenantProcess,
    attributeProcess,
    refreshableToken,
    {
      defaultPollingMaxRetries: config.defaultPollingMaxRetries,
      defaultPollingRetryDelay: config.defaultPollingRetryDelay,
    },
    loggerInstance,
    correlationId
  );
} finally {
  await cleanup();
}
