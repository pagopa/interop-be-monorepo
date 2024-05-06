import {
  authenticationMiddleware,
  loggerContextMiddleware,
  loggerMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import healthRouter from "./routers/HealthRouter.js";
import agreementRouter from "./routers/AgreementRouter.js";

const app = zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(loggerContextMiddleware("agreement-process"));
app.use(loggerMiddleware());

// Unauthenticated routes
app.use(healthRouter);

// Authenticated routes
app.use(authenticationMiddleware());
app.use(agreementRouter(zodiosCtx));

export default app;
