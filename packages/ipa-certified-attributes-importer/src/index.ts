import { logger } from "pagopa-interop-commons";
import { v4 as uuidv4 } from "uuid";

const loggerInstance = logger({
  serviceName: "ipa-certified-attributes-importer",
  correlationId: uuidv4(),
});

loggerInstance.info("Starting ipa-certified-attributes-importer");
