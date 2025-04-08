import {
  authenticationMiddleware,
  contextMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import { serviceName } from "pagopa-interop-models";
import healthRouter from "./routers/HealthRouter.js";
import authorizationRouter from "./routers/AuthorizationRouter.js";
import { config } from "./config/config.js";

const serviceName = serviceName.AUTHORIZATION_PROCESS;

const app = zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(healthRouter);
app.use(contextMiddleware(serviceName));
app.use(await applicationAuditBeginMiddleware(serviceName, config));
app.use(await applicationAuditEndMiddleware(serviceName, config));
app.use(authenticationMiddleware(config));
app.use(authorizationRouter(zodiosCtx));

export default app;
