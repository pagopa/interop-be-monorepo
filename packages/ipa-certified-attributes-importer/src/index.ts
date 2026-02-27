import {
  InteropTokenGenerator,
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

  const registryData = await getRegistryData();

  loggerInstance.info("Getting Platform data");

  const attributes = await readModelServiceSQL.getAttributes();
  const tenants = await readModelServiceSQL.getIPATenants();

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
    readModelServiceSQL,
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
  await cleanup();
}
