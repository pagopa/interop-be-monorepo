import {
  initRedisRateLimiter,
  rateLimiterMiddleware as rateLimiterMiddlewareBuilder,
  startServer,
} from "pagopa-interop-commons";
import { config } from "./config/config.js";
import { M2MGatewayServices, RateLimiterMiddleware, createApp } from "./app.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";
import { agreementServiceBuilder } from "./services/agreementService.js";
import { attributeServiceBuilder } from "./services/attributeService.js";
import { clientServiceBuilder } from "./services/clientService.js";
import { delegationServiceBuilder } from "./services/delegationService.js";
import { eserviceServiceBuilder } from "./services/eserviceService.js";
import { eserviceTemplateServiceBuilder } from "./services/eserviceTemplateService.js";
import { purposeServiceBuilder } from "./services/purposeService.js";
import { tenantServiceBuilder } from "./services/tenantService.js";
import { keysServiceBuilder } from "./services/keysService.js";

const clients = getInteropBeClients();

const services: M2MGatewayServices = {
  agreementService: agreementServiceBuilder(clients),
  attributeService: attributeServiceBuilder(clients),
  clientService: clientServiceBuilder(clients),
  delegationService: delegationServiceBuilder(clients),
  eserviceService: eserviceServiceBuilder(clients),
  eserviceTemplateService: eserviceTemplateServiceBuilder(clients),
  purposeService: purposeServiceBuilder(clients),
  tenantService: tenantServiceBuilder(clients),
  keysService: keysServiceBuilder(clients),
};

const redisRateLimiter = await initRedisRateLimiter({
  limiterGroup: "M2M_GATEWAY",
  maxRequests: config.rateLimiterMaxRequests,
  rateInterval: config.rateLimiterRateInterval,
  burstPercentage: config.rateLimiterBurstPercentage,
  redisHost: config.rateLimiterRedisHost,
  redisPort: config.rateLimiterRedisPort,
  timeout: config.rateLimiterTimeout,
});
const rateLimiterMiddleware: RateLimiterMiddleware =
  rateLimiterMiddlewareBuilder(redisRateLimiter);

const app = await createApp(services, rateLimiterMiddleware);

startServer(app, config);
