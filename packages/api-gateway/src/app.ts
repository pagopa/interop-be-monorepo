import {
  authenticationMiddleware,
  contextMiddleware,
  initRedisRateLimiter,
  loggerMiddleware,
  rateLimiterMiddleware,
  zodiosCtx,
} from "pagopa-interop-commons";
import healthRouter from "./routers/healthRouter.js";
import apiGatewayRouter from "./routers/apiGatewayRouter.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";
import { config } from "./config/config.js";

const serviceName = "api-gateway";

const clients = getInteropBeClients();

const app = zodiosCtx.app();

const redisRateLimiter = await initRedisRateLimiter({
  limiterGroup: "API_GW",
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

app.use(loggerMiddleware(serviceName));

app.use(
  `/api-gateway/${config.apiGatewayInterfaceVersion}`,
  healthRouter,
  contextMiddleware(serviceName, false),
  authenticationMiddleware(config),
  // Authenticated routes - rate limiter relies on auth data to work
  rateLimiterMiddleware(redisRateLimiter),
  apiGatewayRouter(zodiosCtx, clients)
);

export default app;
