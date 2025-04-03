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
import healthRouter from "./routers/HealthRouter.js";
import tenantRouter from "./routers/TenantRouter.js";
import { config } from "./config/config.js";

const serviceName = "tenant-process";
const serviceId = "005";

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
app.use(tenantRouter(zodiosCtx));

export default app;
