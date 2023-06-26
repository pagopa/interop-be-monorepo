import { config } from "./utilities/config.js";
import app from "./app.js";

app.listen(config.port, config.host, () => {
  console.info(`listening on ${config.host}:${config.port}`);
});
