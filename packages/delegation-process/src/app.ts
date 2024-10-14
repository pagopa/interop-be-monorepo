import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";

import healthRouter from "./routers/HealthRouter.js";
import delegationProducerRouter from "./routers/DelegationProducerRouter.js";

const serviceName = "delgation-process";

const app = zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");
app.use(contextMiddleware(serviceName));
app.use(healthRouter);
app.use(authenticationMiddleware);
app.use(loggerMiddleware(serviceName));
app.use(delegationProducerRouter(zodiosCtx));

export default app;
