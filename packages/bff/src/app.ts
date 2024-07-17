import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
  initRedisRateLimiter,
  rateLimiterMiddleware,
} from "pagopa-interop-commons";
import healthRouter from "./routers/HealthRouter.js";
import genericRouter from "./routers/genericRouter.js";
import catalogRouter from "./routers/catalogRouter.js";
import attributeRouter from "./routers/attributeRouter.js";
import purposeRouter from "./routers/purposeRouter.js";
import agreementRouter from "./routers/agreementRouter.js";
import tenantRouter from "./routers/tenantRouter.js";
import selfcareRouter from "./routers/selfcareRouter.js";
import { getInteropBeClients } from "./providers/clientProvider.js";
import { config } from "./config/config.js";

const serviceName = "bff-process";

const clients = getInteropBeClients();

const app = zodiosCtx.app();

const redisRateLimiter = initRedisRateLimiter({
  limiterGroup: "BFF",
  maxRequests: config.rateLimiterMaxRequests,
  rateInterval: config.rateLimiterRateInterval,
  burstPercentage: config.rateLimiterBurstPercentage,
  redisHost: config.rateLimiterRedisHost,
  redisPort: config.rateLimiterRedisPort,
  timeout: config.rateLimiterTimeout,
});

// Disable the "X-Powered-By: Express" HTTP header for security reasons.
// See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
app.disable("x-powered-by");

app.use(contextMiddleware(serviceName, true));
app.use(healthRouter);
app.use(authenticationMiddleware);
app.use(rateLimiterMiddleware(redisRateLimiter));
app.use(loggerMiddleware(serviceName));
app.use(genericRouter(zodiosCtx));
app.use(catalogRouter(zodiosCtx, clients));
app.use(attributeRouter(zodiosCtx));
app.use(purposeRouter(zodiosCtx, clients));
app.use(agreementRouter(zodiosCtx));
app.use(selfcareRouter(zodiosCtx));
app.use(tenantRouter(zodiosCtx));

export default app;
