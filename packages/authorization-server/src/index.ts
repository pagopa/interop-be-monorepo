import { genericLogger } from "pagopa-interop-commons";
import { config } from "./config/config.js";
import app from "./app.js";

const server = app.listen(config.port, config.host, () => {
  genericLogger.info(`listening on ${config.host}:${config.port}`);
});

// eslint-disable-next-line functional/immutable-data
server.keepAliveTimeout = config.keepAliveTimeout;
