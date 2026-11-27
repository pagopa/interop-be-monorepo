import {
  InteropTokenGenerator,
  RefreshableInteropToken,
  getInteropHeaders,
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
import {
  assignNewAttributes,
  buildTenantsIndex,
  createTenantProcessClient,
  createNewAttributes,
  enableSubunitPropagation,
  getAttributesToAssign,
  getAttributesToRevoke,
  getNewAttributes,
  getTenantParentUpdates,
  updateTenantsParent,
  getTenantUpsertData,
  revokeAttributes,
} from "./services/ipaCertifiedAttributesImporterService.js";
import { getRegistryData } from "./services/openDataService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const correlationId = generateId<CorrelationId>();
const loggerInstance = logger({
  serviceName: "ipa-certified-attributes-importer",
  correlationId,
});

loggerInstance.info("Starting ipa-certified-attributes-importer");

const { db: readModelDB, cleanup } = makeDrizzleConnectionWithCleanup(config);

try {
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

  const initialAttributes = await readModelServiceSQL.getAttributes();
  const tenants = await readModelServiceSQL.getIPATenants();

  const token = (await refreshableToken.get()).serialized;
  const headers = getInteropHeaders({ token, correlationId });

  let attributes = initialAttributes;
  let suspendedAttributeIds = new Set<string>();
  let failedPropagationUpdates = 0;

  if (
    isFeatureFlagEnabled(config, "featureFlagAooUoAttributes") &&
    isFeatureFlagEnabled(config, "featureFlagAooUoAttributesForcedPropagation")
  ) {
    loggerInstance.info("Enabling subunit propagation");

    const propagationResult = await enableSubunitPropagation(
      registryData,
      tenants,
      initialAttributes,
      readModelServiceSQL,
      headers,
      loggerInstance,
      config.attributeRegistryUrl,
      {
        defaultPollingMaxRetries: config.defaultPollingMaxRetries,
        defaultPollingRetryDelay: config.defaultPollingRetryDelay,
      }
    );
    attributes = propagationResult.attributes;
    suspendedAttributeIds = propagationResult.suspendedAttributeIds;
    failedPropagationUpdates = propagationResult.failures;
  }

  const tenantUpsertData = getTenantUpsertData(
    registryData,
    tenants,
    config.economicAccountCompaniesAllowlist,
    attributes,
    suspendedAttributeIds
  );

  loggerInstance.info("Creating new attributes");

  const newAttributes = getNewAttributes(
    registryData,
    tenantUpsertData,
    attributes
  );

  const tenantProcessClient = createTenantProcessClient(
    config.tenantProcessUrl
  );

  const failedCreations = await createNewAttributes(
    newAttributes,
    readModelServiceSQL,
    headers,
    loggerInstance,
    config.attributeRegistryUrl,
    config.attributeCreationWaitTime,
    config.defaultPollingMaxRetries
  );

  const tenantsIndex = buildTenantsIndex(tenants);

  loggerInstance.info("Assigning new attributes");

  const attributesToAssign = await getAttributesToAssign(
    tenantsIndex,
    attributes,
    tenantUpsertData,
    config,
    loggerInstance
  );

  const failedUpserts = await assignNewAttributes(
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
    attributes,
    suspendedAttributeIds
  );

  const failedRevocations = await revokeAttributes(
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

  loggerInstance.info("Updating tenants parent");

  const failedParentUpdates = await updateTenantsParent(
    getTenantParentUpdates(registryData, tenantsIndex),
    tenantProcessClient,
    readModelServiceSQL,
    headers,
    loggerInstance,
    {
      defaultPollingMaxRetries: config.defaultPollingMaxRetries,
      defaultPollingRetryDelay: config.defaultPollingRetryDelay,
    }
  );

  loggerInstance.info(
    `IPA certified attributes import completed. Failed propagation updates: ${failedPropagationUpdates}, failed creations: ${failedCreations}, failed upserts: ${failedUpserts}, failed revocations: ${failedRevocations}, failed parent updates: ${failedParentUpdates}`
  );

  if (
    failedCreations > 0 ||
    failedUpserts > 0 ||
    failedRevocations > 0 ||
    failedParentUpdates > 0 ||
    failedPropagationUpdates > 0
  ) {
    process.exitCode = 1;
  }
} catch (error) {
  loggerInstance.error(error);
  process.exitCode = 1;
} finally {
  await cleanup();
}
