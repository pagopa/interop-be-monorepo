import {
  contextDataMiddleware,
  globalContextMiddleware,
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

app.use(globalContextMiddleware);
app.use(contextDataMiddleware);
app.use(loggerMiddleware);
// NOTE(gabro): the order is relevant, authMiddleware must come *after* the routes
// we want to be unauthenticated.
app.use(healthRouter);
app.use(authenticationMiddleware());
app.use(attributeRouter(zodiosCtx));

export default app;
