import {
  InteropTokenGenerator,
  RefreshableInteropToken,
  getInteropHeaders,
  logger,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  makeDrizzleConnection,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { parseIPACertifiedAttributesImporterConfig } from "./config/config.js";
import { getRegistryData } from "./services/openDataService.js";
import {
  assignNewAttributes,
  createTenantProcessClient,
  createNewAttributes,
  getAttributesToAssign,
  getAttributesToRevoke,
  getNewAttributes,
  getTenantUpsertData,
  revokeAttributes,
} from "./services/ipaCertifiedAttributesImporterService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const config = parseIPACertifiedAttributesImporterConfig(process.env);

const correlationId = generateId<CorrelationId>();
const loggerInstance = logger({
  serviceName: "ipa-certified-attributes-importer",
  correlationId,
});

loggerInstance.info("Starting ipa-certified-attributes-importer");

try {
  const readModelDB = makeDrizzleConnection(config);
  const tenantReadModelServiceSQL = tenantReadModelServiceBuilder(readModelDB);
  const attributeReadModelServiceSQL =
    attributeReadModelServiceBuilder(readModelDB);

  const readModelServiceSQL = readModelServiceBuilderSQL({
    readModelDB,
    attributeReadModelServiceSQL,
    tenantReadModelServiceSQL,
  });
  const tokenGenerator = new InteropTokenGenerator(config);
  const refreshableToken = new RefreshableInteropToken(tokenGenerator);
  await refreshableToken.init();

  loggerInstance.info("Getting registry data");

  const registryData = await getRegistryData({
    institutionsUrl: config.institutionsUrl,
    aooUrl: config.aooUrl,
    uoUrl: config.uoUrl,
    institutionsCategoriesUrl: config.institutionsCategoriesUrl,
  });

  loggerInstance.info("Getting Platform data");

  const attributes = await readModelServiceSQL.getAttributes();
  const tenants = await readModelServiceSQL.getIPATenants();

  const tenantUpsertData = getTenantUpsertData(
    registryData,
    tenants,
    config.economicAccountCompaniesAllowlist
  );

  loggerInstance.info("Creating new attributes");

  const newAttributes = getNewAttributes(
    registryData,
    tenantUpsertData,
    attributes
  );

  const token = (await refreshableToken.get()).serialized;
  const headers = getInteropHeaders({ token, correlationId });
  const tenantProcessClient = createTenantProcessClient(config.tenantProcessUrl);

  await createNewAttributes(
    newAttributes,
    readModelServiceSQL,
    headers,
    loggerInstance,
    config.attributeRegistryUrl,
    config.attributeCreationWaitTime
  );

  loggerInstance.info("Assigning new attributes");

  const attributesToAssign = await getAttributesToAssign(
    tenants,
    attributes,
    tenantUpsertData,
    loggerInstance
  );

  await assignNewAttributes(
    attributesToAssign,
    tenantProcessClient,
    readModelServiceSQL,
    headers,
    loggerInstance,
    {
      defaultPollingMaxRetries: config.defaultPollingMaxRetries,
      defaultPollingRetryDelay: config.defaultPollingRetryDelay,
    }
  );

  loggerInstance.info("Revoking attributes");

  const attributesToRevoke = await getAttributesToRevoke(
    tenantUpsertData,
    tenants,
    attributes
  );

  await revokeAttributes(
    attributesToRevoke,
    tenantProcessClient,
    readModelServiceSQL,
    headers,
    loggerInstance,
    {
      defaultPollingMaxRetries: config.defaultPollingMaxRetries,
      defaultPollingRetryDelay: config.defaultPollingRetryDelay,
    }
  );

  loggerInstance.info("IPA certified attributes import completed");
} catch (error) {
  loggerInstance.error(error);
}

process.exit(0);
// process.exit() should not be required.
// however, something in this script hangs on exit.
// TODO figure out why and remove this workaround.
