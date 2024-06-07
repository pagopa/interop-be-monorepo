import { genericLogger } from "pagopa-interop-commons";
import { config } from "./utilities/config.js";
import app from "./app.js";
import { createApiClient } from "./model/generated/api.js";

app.listen(config.port, config.host, () => {
  genericLogger.info(`listening on ${config.host}:${config.port}`);
});

export const createCatalogProcessClient = createApiClient;
