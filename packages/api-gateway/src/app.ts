import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import healthRouter from "./routers/healthRouter.js";
import apiGatewayRouter from "./routers/apiGatewayRouter.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";

const serviceName = "api-gateway";

const clients = getInteropBeClients();

const app = zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(contextMiddleware(serviceName, true));
app.use(healthRouter);
app.use(authenticationMiddleware);
app.use(loggerMiddleware(serviceName));
app.use(apiGatewayRouter(zodiosCtx, clients));

export default app;
