/* eslint-disable no-console */
import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import { applicationAuditMiddleware } from "pagopa-interop-application-audit";
import eservicesRouter from "./routers/EServiceRouter.js";
import healthRouter from "./routers/HealthRouter.js";
import { config } from "./config/config.js";

const serviceName = "catalog-process";

const app = zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(healthRouter);
app.use(contextMiddleware(serviceName));
app.use(authenticationMiddleware(config));
app.use(loggerMiddleware(serviceName));
app.use(await applicationAuditMiddleware(serviceName, config));
app.use(eservicesRouter(zodiosCtx));

export default app;
