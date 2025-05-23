import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  rateLimiterMiddleware as rateLimiterMiddlewareBuilder,
  zodiosCtx,
} from "pagopa-interop-commons";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import healthRouter from "./routers/healthRouter.js";
import apiGatewayRouter from "./routers/apiGatewayRouter.js";
import { config } from "./config/config.js";
import { AgreementService } from "./services/agreementService.js";
import { AttributeService } from "./services/attributeService.js";
import { AuthorizationService } from "./services/authorizationService.js";
import { CatalogService } from "./services/catalogService.js";
import { NotifierEventsService } from "./services/notifierEventsService.js";
import { PurposeService } from "./services/purposeService.js";
import { ReadModelService } from "./services/readModelService.js";
import { TenantService } from "./services/tenantService.js";

export type ApiGatewayServices = {
  agreementService: AgreementService;
  attributeService: AttributeService;
  authorizationService: AuthorizationService;
  catalogService: CatalogService;
  notifierEventsService: NotifierEventsService;
  purposeService: PurposeService;
  tenantService: TenantService;
  readModelService: ReadModelService;
};

export type RateLimiterMiddleware = ReturnType<
  typeof rateLimiterMiddlewareBuilder
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(
  services: ApiGatewayServices,
  rateLimiterMiddleware: RateLimiterMiddleware
) {
  const serviceName = modelsServiceName.API_GATEWAY;

  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.use(loggerMiddleware(serviceName));

  app.use(
    `/api-gateway/${config.apiGatewayInterfaceVersion}`,
    healthRouter,
    contextMiddleware(serviceName, false),
    await applicationAuditBeginMiddleware(serviceName, config),
    await applicationAuditEndMiddleware(serviceName, config),
    authenticationMiddleware(config),
    // Authenticated routes - rate limiter relies on auth data to work
    rateLimiterMiddleware,
    apiGatewayRouter(services, zodiosCtx)
  );
  return app;
}
