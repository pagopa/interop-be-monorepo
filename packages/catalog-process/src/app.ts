import { zodiosContext } from "@zodios/express";
import * as expressWinston from "express-winston";
import { logger } from "pagopa-interop-commons";
import { z } from "zod";
import { authMiddleware } from "./authMiddleware.js";
import { ctx } from "./context.js";
import eservicesRouter from "./routers/CatalogRouter.js";
import healthRouter from "./routers/HealthRouter.js";
import { config } from "./utilities/config.js";

const zodiosCtx = zodiosContext(z.object({ ctx }));
const app = zodiosCtx.app();

export type ZodiosContext = NonNullable<typeof zodiosCtx>;
export type ExpressContext = NonNullable<typeof zodiosCtx.context>;

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

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

// NOTE(gabro): the order is relevant, authMiddleware must come *after* the routes
// we want to be unauthenticated.
app.use(healthRouter);
app.use(authMiddleware);
app.use(eservicesRouter(zodiosCtx));

export default app;
