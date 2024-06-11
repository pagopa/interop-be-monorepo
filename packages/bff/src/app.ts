import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import healthRouter from "./routers/HealthRouter.js";
import genericRouter from "./routers/genericRouter.js";
import catalogRouter from "./routers/catalogRouter.js";
import attributeRouter from "./routers/attributeRouter.js";
import purposeRouter from "./routers/purposeRouter.js";
import agreementRouter from "./routers/agreementRouter.js";
import tenantRouter from "./routers/tenantRouter.js";

const serviceName = "bff-process";

const app = zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(contextMiddleware(serviceName));
app.use(healthRouter);
app.use(authenticationMiddleware);
app.use(loggerMiddleware(serviceName));
app.use(genericRouter(zodiosCtx));
app.use(catalogRouter(zodiosCtx));
app.use(attributeRouter(zodiosCtx));
app.use(purposeRouter(zodiosCtx));
app.use(agreementRouter(zodiosCtx));
app.use(tenantRouter(zodiosCtx));

export default app;
