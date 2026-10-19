import { attributeRegistryApi } from "pagopa-interop-api-clients";
import {
  InteropTokenGenerator,
  RefreshableInteropToken,
  isFeatureFlagEnabled,
  logger,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  makeDrizzleConnectionWithCleanup,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";

import { config } from "./config/config.js";
import { AttributeProcessService } from "./service/attributeProcessService.js";
import { IstatClient } from "./service/istatClient.js";
import { importAttributes } from "./service/processor.js";
import { readModelQueriesBuilderSQL } from "./service/readModelServiceSQL.js";
import { TenantProcessService } from "./service/tenantProcessService.js";

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
  serviceName: "istat-certified-attributes-importer",
  correlationId,
});

const processExit = async (exitCode: number) => {
  await cleanup();
  process.exit(exitCode);
};

try {
  if (!isFeatureFlagEnabled(config, "featureFlagAttributeCertifiedDiscrete")) {
    loggerInstance.info(
      "Feature flag 'featureFlagAttributeCertifiedDiscrete' is disabled. Skipping ISTAT import execution."
    );
    await processExit(0);
  } else {
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
      config.csvChunkSize,
      loggerInstance,
      correlationId
    );
    await processExit(0);
  }
} catch (error) {
  loggerInstance.error(`Error during ISTAT import execution: ${error}`);
  await processExit(1);
}
