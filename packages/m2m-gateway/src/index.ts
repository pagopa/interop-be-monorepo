import {
  initFileManager,
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
import { keyServiceBuilder } from "./services/keyService.js";
import { producerKeychainServiceBuilder } from "./services/producerKeychainService.js";
import { eventServiceBuilder } from "./services/eventService.js";

const clients = getInteropBeClients();
const fileManager = initFileManager(config);

const services: M2MGatewayServices = {
  agreementService: agreementServiceBuilder(clients, fileManager),
  attributeService: attributeServiceBuilder(clients),
  clientService: clientServiceBuilder(clients),
  delegationService: delegationServiceBuilder(clients),
  eserviceService: eserviceServiceBuilder(clients, fileManager),
  eserviceTemplateService: eserviceTemplateServiceBuilder(clients, fileManager),
  purposeService: purposeServiceBuilder(clients, fileManager),
  tenantService: tenantServiceBuilder(clients),
  keyService: keyServiceBuilder(clients),
  producerKeychainService: producerKeychainServiceBuilder(clients),
  eventService: eventServiceBuilder(clients),
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
