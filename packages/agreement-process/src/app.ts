import { zodiosContext } from "@zodios/express";
import * as expressWinston from "express-winston";
import { logger } from "pagopa-interop-commons";
import healthRouter from "./routers/HealthRouter.js";
import { config } from "./utilities/config.js";
import testPdfGenRouter from "./routers/TestPdfGen.js";

const zodiosCtx = zodiosContext();
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
    ignoredRoutes: ["/status"],
    responseWhitelist:
      config.logLevel === "debug"
        ? ["body", "statusCode", "statusMessage"]
        : [],
  })
);

// NOTE(gabro): the order is relevant, authMiddleware must come *after* the routes
// we want to be unauthenticated.
app.use(healthRouter);
app.use(testPdfGenRouter);

export default app;
