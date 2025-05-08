import { genericLogger } from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { createApp } from "./app.js";

const app = await createApp();
app.listen(config.port, config.host, () => {
  genericLogger.info(`listening on ${config.host}:${config.port}`);
});
