import {
  ExpressContext,
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import { ZodiosApp } from "@zodios/express";
import { ZodiosEndpointDefinitions } from "@zodios/core";
import eservicesRouter from "./routers/EServiceRouter.js";
import healthRouter from "./routers/HealthRouter.js";

const serviceName = "catalog-process";

const app: ZodiosApp<ZodiosEndpointDefinitions, ExpressContext> =
  zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(contextMiddleware(serviceName));
app.use(healthRouter);
app.use(authenticationMiddleware);
app.use(loggerMiddleware(serviceName));
app.use(eservicesRouter(zodiosCtx));

export default app;
