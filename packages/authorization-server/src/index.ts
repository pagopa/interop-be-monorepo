import { genericLogger } from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { fastifyServer } from "./services/app.js";

// app.listen(config.port, config.host, () => {
//   genericLogger.info(`listening on ${config.host}:${config.port}`);
// });

try {
  await fastifyServer.listen({ host: config.host, port: config.port });

  const address = fastifyServer.server.address();
  if (typeof address === "string") {
    genericLogger.info(`Server started on http://${address}`);
  } else {
    genericLogger.info(
      `Server started on http://${address?.address}:${address?.port}`
    );
  }
} catch (err) {
  fastifyServer.log.error(err);
  process.exit(1);
}
