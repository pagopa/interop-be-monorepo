import {
  initRedisRateLimiter,
  startServer,
  rateLimiterMiddleware as rateLimiterMiddlewareBuilder,
  ReadModelRepository,
} from "pagopa-interop-commons";
import {
  makeDrizzleConnection,
  clientJWKKeyReadModelServiceBuilder,
  producerJWKKeyReadModelServiceBuilder,
} from "pagopa-interop-readmodel";
import { config } from "./config/config.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";
import { ApiGatewayServices, RateLimiterMiddleware, createApp } from "./app.js";
import { agreementServiceBuilder } from "./services/agreementService.js";
import { attributeServiceBuilder } from "./services/attributeService.js";
import { authorizationServiceBuilder } from "./services/authorizationService.js";
import { catalogServiceBuilder } from "./services/catalogService.js";
import { notifierEventsServiceBuilder } from "./services/notifierEventsService.js";
import { purposeServiceBuilder } from "./services/purposeService.js";
import { readModelServiceBuilder } from "./services/readModelService.js";
import { readModelServiceBuilderSQL } from "./services/readModelServiceSQL.js";
import { tenantServiceBuilder } from "./services/tenantService.js";

const clients = getInteropBeClients();

const catalogService = catalogServiceBuilder(clients);

const agreementService = agreementServiceBuilder(clients);

const purposeService = purposeServiceBuilder(clients);

const tenantService = tenantServiceBuilder(clients);

const notifierEventsService = notifierEventsServiceBuilder(clients);

const attributeService = attributeServiceBuilder(clients);

const oldReadModelService = readModelServiceBuilder(
  ReadModelRepository.init(config)
);

const db = makeDrizzleConnection(config);
const clientJWKKeyReadModelServiceSQL = clientJWKKeyReadModelServiceBuilder(db);
const producerJWKKeyReadModelServiceSQL =
  producerJWKKeyReadModelServiceBuilder(db);

const readModelServiceSQL = readModelServiceBuilderSQL(
  clientJWKKeyReadModelServiceSQL,
  producerJWKKeyReadModelServiceSQL
);

const readModelService =
  config.featureFlagSQL &&
  config.readModelSQLDbHost &&
  config.readModelSQLDbPort
    ? readModelServiceSQL
    : oldReadModelService;

const authorizationService = authorizationServiceBuilder(
  clients,
  readModelService
);

const redisRateLimiter = await initRedisRateLimiter({
  limiterGroup: "API_GW",
  maxRequests: config.rateLimiterMaxRequests,
  rateInterval: config.rateLimiterRateInterval,
  burstPercentage: config.rateLimiterBurstPercentage,
  redisHost: config.rateLimiterRedisHost,
  redisPort: config.rateLimiterRedisPort,
  timeout: config.rateLimiterTimeout,
});

const rateLimiterMiddleware: RateLimiterMiddleware =
  rateLimiterMiddlewareBuilder(redisRateLimiter);

const services: ApiGatewayServices = {
  catalogService,
  agreementService,
  purposeService,
  tenantService,
  notifierEventsService,
  attributeService,
  authorizationService,
  readModelService,
};

const app = await createApp(services, rateLimiterMiddleware);

startServer(app, config);
