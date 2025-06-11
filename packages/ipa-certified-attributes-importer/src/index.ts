import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  getInteropHeaders,
  logger,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
import {
  attributeReadModelServiceBuilder,
  makeDrizzleConnectionWithCleanup,
  tenantReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { getRegistryData } from "./services/openDataService.js";
import {
  assignNewAttributes,
  createNewAttributes,
  getAttributesToAssign,
  getAttributesToRevoke,
  getNewAttributes,
  getTenantUpsertData,
  revokeAttributes,
} from "./services/ipaCertifiedAttributesImporterService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";

const correlationId = generateId<CorrelationId>();
const loggerInstance = logger({
  serviceName: "ipa-certified-attributes-importer",
  correlationId,
});

loggerInstance.info("Starting ipa-certified-attributes-importer");

const { connection: readModelDB, cleanup: drizzleCleanup } =
  makeDrizzleConnectionWithCleanup(config);

async function main(): Promise<void> {
  try {
    const tenantReadModelServiceSQL =
      tenantReadModelServiceBuilder(readModelDB);
    const attributeReadModelServiceSQL =
      attributeReadModelServiceBuilder(readModelDB);

    const oldReadModelService = readModelServiceBuilder(
      ReadModelRepository.init(config)
    );
    const readModelServiceSQL = readModelServiceBuilderSQL({
      readModelDB,
      attributeReadModelServiceSQL,
      tenantReadModelServiceSQL,
    });
    const readModelService =
      config.featureFlagSQL &&
      config.readModelSQLDbHost &&
      config.readModelSQLDbPort
        ? readModelServiceSQL
        : oldReadModelService;

    const tokenGenerator = new InteropTokenGenerator(config);
    const refreshableToken = new RefreshableInteropToken(tokenGenerator);
    await refreshableToken.init();

    loggerInstance.info("Getting registry data");

    const registryData = await getRegistryData();

    loggerInstance.info("Getting Platform data");

    const attributes = await readModelService.getAttributes();
    const tenants = await readModelService.getIPATenants();

    const tenantUpsertData = getTenantUpsertData(registryData, tenants);

    loggerInstance.info("Creating new attributes");

    const newAttributes = getNewAttributes(
      registryData,
      tenantUpsertData,
      attributes
    );

    const token = (await refreshableToken.get()).serialized;
    const headers = getInteropHeaders({ token, correlationId });
    await createNewAttributes(
      newAttributes,
      readModelService,
      headers,
      loggerInstance
    );

    loggerInstance.info("Assigning new attributes");

    const attributesToAssign = await getAttributesToAssign(
      tenants,
      attributes,
      tenantUpsertData,
      loggerInstance
    );

    await assignNewAttributes(attributesToAssign, headers, loggerInstance);

    loggerInstance.info("Revoking attributes");

    const attributesToRevoke = await getAttributesToRevoke(
      tenantUpsertData,
      tenants,
      attributes
    );

    await revokeAttributes(attributesToRevoke, headers, loggerInstance);

    loggerInstance.info("IPA certified attributes import completed");
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
