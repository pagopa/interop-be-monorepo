import { config } from "./utilities/config.js";
import { logger } from "./utilities/logger.js";
import app from "./app.js";

app.listen(config.port, config.host, () => {
  logger.info(`listening on ${config.host}:${config.port}`);
});
