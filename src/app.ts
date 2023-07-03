import { zodiosContext } from "@zodios/express";
import * as expressWinston from "express-winston";
import eservicesRouter from "./routers/catalog.js";
import healthRouter from "./routers/health.js";
import { config } from "./utilities/config.js";
import { logger } from "./utilities/logger.js";
import { authMiddleware } from "./authMiddleware.js";
import { appContext } from "./context.js";

export const ctx = zodiosContext(appContext);
const app = ctx.app();

export type ExpressContext = NonNullable<typeof ctx.context>;

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

app.use(authMiddleware);
app.use(healthRouter, eservicesRouter);

export default app;
