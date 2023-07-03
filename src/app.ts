import * as expressWinston from "express-winston";
import { zodiosApp } from "@zodios/express";
import { logger } from "./utilities/logger.js";
import { config } from "./utilities/config.js";
import healthRouter from "./routers/health.js";
import eservicesRouter from "./routers/catalog.js";

const app = zodiosApp();

app.use(
  expressWinston.logger({
    winstonInstance: logger,
    metaField: null,
    requestWhitelist:
      config.logLevel === "debug" ? ["body", "headers", "query"] : [],
    responseWhitelist:
      config.logLevel === "debug"
        ? ["body", "statusCode", "statusMessage"]
        : [],
  })
);

app.use(healthRouter, eservicesRouter);

export default app;
