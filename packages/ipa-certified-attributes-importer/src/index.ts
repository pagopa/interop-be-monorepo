import {
  InteropTokenGenerator,
  ReadModelRepository,
  RefreshableInteropToken,
  getInteropHeaders,
  logger,
} from "pagopa-interop-commons";
import { CorrelationId, generateId } from "pagopa-interop-models";
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

const correlationId = generateId<CorrelationId>();
const loggerInstance = logger({
  serviceName: "ipa-certified-attributes-importer",
  correlationId,
});

loggerInstance.info("Starting ipa-certified-attributes-importer");

try {
  const readModelService = readModelServiceBuilder(
    ReadModelRepository.init(config)
  );

  const tokenGenerator = new InteropTokenGenerator(config);
  const refreshableToken = new RefreshableInteropToken(tokenGenerator);
  await refreshableToken.init();

  loggerInstance.info("Getting registry data");

  const registryData = await getRegistryData();

  loggerInstance.info("Getting Plaform data");

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

  loggerInstance.info("Assignin new attributes");

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
}

process.exit(0);
// process.exit() should not be required.
// however, something in this script hangs on exit.
// TODO figure out why and remove this workaround.
