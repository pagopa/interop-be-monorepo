import { zodiosContext } from "@zodios/express";
import {
  contextDataMiddleware,
  globalContextMiddleware,
  loggerMiddleware,
} from "pagopa-interop-commons";
import healthRouter from "./routers/HealthRouter.js";

const zodiosCtx = zodiosContext();
const app = zodiosCtx.app();

export type ZodiosContext = NonNullable<typeof zodiosCtx>;
export type ExpressContext = NonNullable<typeof zodiosCtx.context>;

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(globalContextMiddleware);
app.use(contextDataMiddleware);
app.use(loggerMiddleware);

// NOTE(gabro): the order is relevant, authMiddleware must come *after* the routes
// we want to be unauthenticated.
app.use(healthRouter);

export default app;
