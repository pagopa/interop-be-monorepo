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
import attributeRouter from "./routers/attributeRouter.js";
import eserviceRouter from "./routers/eserviceRouter.js";
import purposeRouter from "./routers/purposeRouter.js";
import tenantRouter from "./routers/tenantRouter.js";
import delegationRouter from "./routers/delegationRouter.js";
import eserviceTemplateRouter from "./routers/eserviceTemplateRouter.js";
import clientRouter from "./routers/clientRouter.js";
import { appBasePath } from "./config/appBasePath.js";
import {
  DelegationService,
  delegationServiceBuilder,
} from "./services/delegationService.js";
import {
  AgreementService,
  agreementServiceBuilder,
} from "./services/agreementService.js";
import {
  AttributeService,
  attributeServiceBuilder,
} from "./services/attributeService.js";
import {
  ClientService,
  clientServiceBuilder,
} from "./services/clientService.js";
import {
  EserviceService,
  eserviceServiceBuilder,
} from "./services/eserviceService.js";
import {
  EserviceTemplateService,
  eserviceTemplateServiceBuilder,
} from "./services/eserviceTemplateService.js";
import {
  PurposeService,
  purposeServiceBuilder,
} from "./services/purposeService.js";
import {
  TenantService,
  tenantServiceBuilder,
} from "./services/tenantService.js";

type M2MGatewayServices = {
  agreementService: AgreementService;
  attributeService: AttributeService;
  clientService: ClientService;
  delegationService: DelegationService;
  eserviceService: EserviceService;
  eserviceTemplateService: EserviceTemplateService;
  purposeService: PurposeService;
  tenantService: TenantService;
};

function createDefaultM2MGatewayServices(): M2MGatewayServices {
  const clients = getInteropBeClients();

  return {
    agreementService: agreementServiceBuilder(clients),
    attributeService: attributeServiceBuilder(clients),
    clientService: clientServiceBuilder(clients),
    delegationService: delegationServiceBuilder(clients),
    eserviceService: eserviceServiceBuilder(clients),
    eserviceTemplateService: eserviceTemplateServiceBuilder(clients),
    purposeService: purposeServiceBuilder(clients),
    tenantService: tenantServiceBuilder(clients),
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(services?: M2MGatewayServices) {
  const serviceName = modelsServiceName.M2M_GATEWAY;
  const {
    agreementService,
    attributeService,
    clientService,
    delegationService,
    eserviceService,
    eserviceTemplateService,
    purposeService,
    tenantService,
  } = services ?? createDefaultM2MGatewayServices();

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
    appBasePath,
    healthRouter,
    contextMiddleware(serviceName, false),
    await applicationAuditBeginMiddleware(serviceName, config),
    await applicationAuditEndMiddleware(serviceName, config),
    authenticationMiddleware(config),
    // Authenticated routes - rate limiter relies on auth data to work
    rateLimiterMiddleware(redisRateLimiter),
    eserviceRouter(zodiosCtx, eserviceService),
    attributeRouter(zodiosCtx, attributeService),
    purposeRouter(zodiosCtx, purposeService),
    agreementRouter(zodiosCtx, agreementService),
    tenantRouter(zodiosCtx, tenantService),
    delegationRouter(zodiosCtx, delegationService),
    eserviceTemplateRouter(zodiosCtx, eserviceTemplateService),
    clientRouter(zodiosCtx, clientService)
  );

  return app;
}
