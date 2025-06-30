import {
  initFileManager,
  initRedisRateLimiter,
  rateLimiterMiddleware as rateLimiterMiddlewareBuilder,
  startServer,
} from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { createApp, createServices, serviceName } from "./app.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";
import getAllowList from "./utilities/getAllowList.js";

const clients = getInteropBeClients();

const redisRateLimiter = await initRedisRateLimiter({
  limiterGroup: "BFF",
  maxRequests: config.rateLimiterMaxRequests,
  rateInterval: config.rateLimiterRateInterval,
  burstPercentage: config.rateLimiterBurstPercentage,
  redisHost: config.rateLimiterRedisHost,
  redisPort: config.rateLimiterRedisPort,
  timeout: config.rateLimiterTimeout,
});

const rateLimiterMiddleware = rateLimiterMiddlewareBuilder(redisRateLimiter);

const fileManager = initFileManager(config);

const authorizationServiceAllowList = await getAllowList(
  serviceName,
  fileManager,
  config
);

const services = await createServices(
  clients,
  fileManager,
  redisRateLimiter,
  authorizationServiceAllowList
);

startServer(await createApp(services, rateLimiterMiddleware), config);
