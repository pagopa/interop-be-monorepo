import { Response } from "express";
import { makeApiProblem } from "pagopa-interop-models";
import {
  contextDataMiddleware,
  globalContextMiddleware,
  loggerMiddleware,
  authenticationMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import eservicesRouter from "./routers/EServiceRouter.js";
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
app.use(
  // The following callback handles generic authorization errors with current service behaviour
  authenticationMiddleware((error: unknown, res: Response) => {
    const apiError = makeApiProblem(error);
    res.status(apiError.status).json(apiError).end();
  })
);
app.use(eservicesRouter(zodiosCtx));

export default app;
