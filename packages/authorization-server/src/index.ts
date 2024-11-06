import { genericLogger } from "pagopa-interop-commons";
import { config } from "./config/config.js";
import app from "./app.js";

try {
  await app.listen({ host: config.host, port: config.port });

  const address = app.server.address();
  if (typeof address === "string") {
    genericLogger.info(`Server started on http://${address}`);
  } else {
    genericLogger.info(
      `Server started on http://${address?.address}:${address?.port}`
    );
  }
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
