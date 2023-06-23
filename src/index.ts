import { config } from "./utilities/config.js";
import app from "./app.js";

app.listen(config.port, config.host, () => {
  /* eslint-disable no-console */
  console.info(`listening on ${config.host}:${config.port}`);
});
