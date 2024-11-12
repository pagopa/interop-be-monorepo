import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
  buildJwksClients,
} from "pagopa-interop-commons";

import healthRouter from "./routers/HealthRouter.js";
import delegationProducerRouter from "./routers/DelegationProducerRouter.js";
import delegationRouter from "./routers/DelegationRouter.js";
import { config } from "./config/config.js";

const serviceName = "delgation-process";

const app = zodiosCtx.app();

const jwksClients = buildJwksClients(config);

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(healthRouter);
app.use(contextMiddleware(serviceName));
app.use(authenticationMiddleware(config, jwksClients));
app.use(loggerMiddleware(serviceName));
app.use(delegationRouter(zodiosCtx));
app.use(delegationProducerRouter(zodiosCtx));

export default app;
