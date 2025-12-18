import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
  initRedisRateLimiter,
  rateLimiterMiddleware,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import { config } from "./config/config.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";
import healthRouter from "./routers/HealthRouter.js";
import agreementRouter from "./routers/agreementRouter.js";

const serviceName = modelsServiceName.M2M_GATEWAY;

const clients = getInteropBeClients();

const app = zodiosCtx.app();

const redisRateLimiter = await initRedisRateLimiter({
  limiterGroup: "M2M_GATEWAY",
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

app.disable("etag");

app.use(loggerMiddleware(serviceName));

app.use(
  `/m2m-gateway/${config.m2mGatewayInterfaceVersion}`,
  healthRouter,
  contextMiddleware(serviceName, false),
  await applicationAuditBeginMiddleware(serviceName, config),
  await applicationAuditEndMiddleware(serviceName, config),
  authenticationMiddleware(config),
  // Authenticated routes - rate limiter relies on auth data to work
  rateLimiterMiddleware(redisRateLimiter),
  agreementRouter(zodiosCtx, clients),
);

export default app;