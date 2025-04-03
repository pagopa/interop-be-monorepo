import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import attributeRouter from "./routers/AttributeRouter.js";
import healthRouter from "./routers/HealthRouter.js";
import { config } from "./config/config.js";

const serviceName = "attribute-registry-process";
const serviceId = "003";

const app = zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(healthRouter);
app.use(contextMiddleware(serviceName, serviceId));
app.use(await applicationAuditBeginMiddleware(serviceName, config));
app.use(await applicationAuditEndMiddleware(serviceName, config));
app.use(authenticationMiddleware(config));
app.use(loggerMiddleware(serviceName));
app.use(attributeRouter(zodiosCtx));

export default app;
