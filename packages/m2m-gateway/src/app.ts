import {
  authenticationMiddleware,
  contextMiddleware,
  fromFilesToBodyMiddleware,
  loggerMiddleware,
  multerMiddleware,
  rateLimiterMiddleware as rateLimiterMiddlewareBuilder,
  zodiosCtx,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import { config } from "./config/config.js";
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
import { DelegationService } from "./services/delegationService.js";
import { AgreementService } from "./services/agreementService.js";
import { AttributeService } from "./services/attributeService.js";
import { ClientService } from "./services/clientService.js";
import { EserviceService } from "./services/eserviceService.js";
import { EserviceTemplateService } from "./services/eserviceTemplateService.js";
import { PurposeService } from "./services/purposeService.js";
import { TenantService } from "./services/tenantService.js";
import { m2mAuthDataValidationMiddleware } from "./utils/middlewares.js";
import { KeyService } from "./services/keyService.js";
import keyRouter from "./routers/keyRouter.js";

export type M2MGatewayServices = {
  agreementService: AgreementService;
  attributeService: AttributeService;
  clientService: ClientService;
  delegationService: DelegationService;
  eserviceService: EserviceService;
  eserviceTemplateService: EserviceTemplateService;
  purposeService: PurposeService;
  tenantService: TenantService;
  keyService: KeyService;
};

export type RateLimiterMiddleware = ReturnType<
  typeof rateLimiterMiddlewareBuilder
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(
  services: M2MGatewayServices,
  rateLimiterMiddleware: RateLimiterMiddleware
) {
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
    keyService,
  } = services;

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.disable("etag");

  // parse files from multipart/form-data and put them in req.body
  app.use(multerMiddleware);
  app.use(fromFilesToBodyMiddleware);

  app.use(loggerMiddleware(serviceName));

  app.use(
    appBasePath,
    healthRouter,
    contextMiddleware(serviceName, false),
    await applicationAuditBeginMiddleware(serviceName, config),
    await applicationAuditEndMiddleware(serviceName, config),
    authenticationMiddleware(config),
    // Authenticated routes (rate limiter & authorization middlewares rely on auth data to work)
    m2mAuthDataValidationMiddleware(clientService),
    rateLimiterMiddleware,
    eserviceRouter(zodiosCtx, eserviceService),
    attributeRouter(zodiosCtx, attributeService),
    purposeRouter(zodiosCtx, purposeService),
    agreementRouter(zodiosCtx, agreementService),
    tenantRouter(zodiosCtx, tenantService),
    delegationRouter(zodiosCtx, delegationService),
    eserviceTemplateRouter(zodiosCtx, eserviceTemplateService),
    clientRouter(zodiosCtx, clientService),
    keyRouter(zodiosCtx, keyService)
  );

  return app;
}
