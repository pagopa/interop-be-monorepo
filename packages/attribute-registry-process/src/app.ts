import {
  loggerContextMiddleware,
  loggerMiddleware,
  authenticationMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import attributeRouter from "./routers/AttributeRouter.js";
import healthRouter from "./routers/HealthRouter.js";

const app = zodiosCtx.app();

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(loggerContextMiddleware("attribute-registry-process"));
app.use(loggerMiddleware());

// Unauthenticated routes
app.use(healthRouter);

// Authenticated routes
app.use(authenticationMiddleware());
app.use(attributeRouter(zodiosCtx));

export default app;
