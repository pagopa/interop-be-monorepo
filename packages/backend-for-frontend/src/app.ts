import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  authenticationMiddleware,
  contextMiddleware,
  loggerMiddleware,
  zodiosCtx,
  rateLimiterMiddleware as rateLimiterMiddlewareBuilder,
  InteropTokenGenerator,
  RateLimiter,
  FileManager,
  fromFilesToBodyMiddleware,
  multerMiddleware,
  errorsToApiProblemsMiddleware,
} from "pagopa-interop-commons";
import express from "express";
import {
  applicationAuditBeginMiddleware,
  applicationAuditEndSessionTokenExchangeMiddleware,
  applicationAuditEndMiddleware,
} from "pagopa-interop-application-audit";
import { serviceName as modelsServiceName } from "pagopa-interop-models";
import { bffApi } from "pagopa-interop-api-clients";
import { config } from "./config/config.js";
import privacyNoticeRouter from "./routers/privacyNoticeRouter.js";
import healthRouter from "./routers/HealthRouter.js";
import swaggerRouter from "./routers/swaggerRouter.js";
import agreementRouter from "./routers/agreementRouter.js";
import attributeRouter from "./routers/attributeRouter.js";
import authorizationRouter from "./routers/authorizationRouter.js";
import catalogRouter from "./routers/catalogRouter.js";
import purposeRouter from "./routers/purposeRouter.js";
import purposeTemplateRouter from "./routers/purposeTemplateRouter.js";
import selfcareRouter from "./routers/selfcareRouter.js";
import supportRouter from "./routers/supportRouter.js";
import tenantRouter from "./routers/tenantRouter.js";
import toolRouter from "./routers/toolRouter.js";
import { uiAuthDataValidationMiddleware } from "./utilities/middlewares.js";
import clientRouter from "./routers/clientRouter.js";
import producerKeychainRouter from "./routers/producerKeychainRouter.js";
import delegationRouter from "./routers/delegationRouter.js";
import producerDelegationRouter from "./routers/producerDelegationRouter.js";
import consumerDelegationRouter from "./routers/consumerDelegationRouter.js";
import eserviceTemplateRouter from "./routers/eserviceTemplateRouter.js";
import emailDeeplinkRouter from "./routers/emailDeeplinkRouter.js";
import { appBasePath } from "./config/appBasePath.js";
import {
  AgreementService,
  agreementServiceBuilder,
} from "./services/agreementService.js";
import {
  AttributeService,
  attributeServiceBuilder,
} from "./services/attributeService.js";
import {
  AuthorizationService,
  authorizationServiceBuilder,
} from "./services/authorizationService.js";
import {
  CatalogService,
  catalogServiceBuilder,
} from "./services/catalogService.js";
import {
  ClientService,
  clientServiceBuilder,
} from "./services/clientService.js";
import {
  DelegationService,
  delegationServiceBuilder,
} from "./services/delegationService.js";
import {
  EServiceTemplateService,
  eserviceTemplateServiceBuilder,
} from "./services/eserviceTemplateService.js";
import {
  ProducerKeychainService,
  producerKeychainServiceBuilder,
} from "./services/producerKeychainService.js";
import {
  PurposeService,
  purposeServiceBuilder,
} from "./services/purposeService.js";
import {
  PurposeTemplateService,
  purposeTemplateServiceBuilder,
} from "./services/purposeTemplateService.js";
import {
  SelfcareService,
  selfcareServiceBuilder,
} from "./services/selfcareService.js";
import {
  TenantService,
  tenantServiceBuilder,
} from "./services/tenantService.js";
import { PagoPAInteropBeClients } from "./clients/clientsProvider.js";
import { ToolsService, toolsServiceBuilder } from "./services/toolService.js";
import { privacyNoticeStorageServiceBuilder } from "./services/privacyNoticeStorage.js";
import {
  PrivacyNoticeService,
  privacyNoticeServiceBuilder,
} from "./services/privacyNoticeService.js";
import {
  NotificationConfigService,
  notificationConfigServiceBuilder,
} from "./services/notificationConfigService.js";
import notificationConfigRouter from "./routers/notificationConfigRouter.js";
import {
  InAppNotificationService,
  inAppNotificationServiceBuilder,
} from "./services/inAppNotificationService.js";
import inAppNotificationRouter from "./routers/inAppNotificationRouter.js";

export type BFFServices = {
  agreementService: AgreementService;
  attributeService: AttributeService;
  authorizationService: AuthorizationService;
  authorizationServiceForSupport: AuthorizationService;
  catalogService: CatalogService;
  clientService: ClientService;
  delegationService: DelegationService;
  notificationConfigService: NotificationConfigService;
  inAppNotificationService: InAppNotificationService;
  eServiceTemplateService: EServiceTemplateService;
  privacyNoticeService: PrivacyNoticeService;
  producerKeychainService: ProducerKeychainService;
  purposeService: PurposeService;
  purposeTemplateService: PurposeTemplateService;
  selfcareService: SelfcareService;
  tenantService: TenantService;
  toolsService: ToolsService;
};

export type RateLimiterMiddleware = ReturnType<
  typeof rateLimiterMiddlewareBuilder
>;

export const serviceName = modelsServiceName.BACKEND_FOR_FRONTEND;

export async function createServices(
  clients: PagoPAInteropBeClients,
  fileManager: FileManager,
  redisRateLimiter: RateLimiter,
  authorizationServiceAllowList: string[],
  interopTokenGenerator: InteropTokenGenerator
): Promise<BFFServices> {

  const consentTypeMap: Map<bffApi.ConsentType, string> = new Map([
    [bffApi.ConsentType.Values.PP, config.privacyNoticesPpUuid],
    [bffApi.ConsentType.Values.TOS, config.privacyNoticesTosUuid],
  ]);
  const privacyNoticeStorage = privacyNoticeStorageServiceBuilder(
    new DynamoDBClient(),
    config.privacyNoticesDynamoTableName,
    config.privacyNoticesUsersDynamoTableName
  );

  return {
    agreementService: agreementServiceBuilder(clients, fileManager),
    attributeService: attributeServiceBuilder(clients.attributeProcessClient),
    authorizationService: authorizationServiceBuilder(
      interopTokenGenerator,
      clients.tenantProcessClient,
      authorizationServiceAllowList,
      redisRateLimiter
    ),
    authorizationServiceForSupport: authorizationServiceBuilder(
      interopTokenGenerator,
      clients.tenantProcessClient,
      config.tenantAllowedOrigins,
      redisRateLimiter
    ),
    catalogService: catalogServiceBuilder(
      clients.catalogProcessClient,
      clients.tenantProcessClient,
      clients.agreementProcessClient,
      clients.attributeProcessClient,
      clients.delegationProcessClient,
      clients.eserviceTemplateProcessClient,
      clients.inAppNotificationManagerClient,
      fileManager,
      config
    ),
    clientService: clientServiceBuilder(clients),
    delegationService: delegationServiceBuilder(
      clients.delegationProcessClient,
      clients.tenantProcessClient,
      clients.catalogProcessClient,
      clients.inAppNotificationManagerClient,
      fileManager
    ),
    eServiceTemplateService: eserviceTemplateServiceBuilder(
      clients.eserviceTemplateProcessClient,
      clients.tenantProcessClient,
      clients.attributeProcessClient,
      clients.catalogProcessClient,
      clients.inAppNotificationManagerClient,
      fileManager
    ),
    notificationConfigService: notificationConfigServiceBuilder(
      clients.notificationConfigProcessClient
    ),
    inAppNotificationService: inAppNotificationServiceBuilder(
      clients.inAppNotificationManagerClient
    ),
    privacyNoticeService: privacyNoticeServiceBuilder(
      privacyNoticeStorage,
      fileManager,
      consentTypeMap
    ),
    producerKeychainService: producerKeychainServiceBuilder(clients),
    purposeService: purposeServiceBuilder(clients, fileManager),
    purposeTemplateService: purposeTemplateServiceBuilder(
      clients.purposeTemplateProcessClient,
      clients.tenantProcessClient,
      clients.catalogProcessClient,
      fileManager
    ),
    selfcareService: selfcareServiceBuilder(clients),
    tenantService: tenantServiceBuilder(
      clients.tenantProcessClient,
      clients.attributeProcessClient,
      clients.selfcareV2InstitutionClient
    ),
    toolsService: toolsServiceBuilder(clients),
  };
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function createApp(
  services: BFFServices,
  rateLimiterMiddleware: RateLimiterMiddleware,
  clients: PagoPAInteropBeClients,
  interopTokenGenerator: InteropTokenGenerator
) {
  const app = zodiosCtx.app();

  // Disable the "X-Powered-By: Express" HTTP header for security reasons.
  // See https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html#recommendation_16
  app.disable("x-powered-by");

  app.disable("etag");

  // parse files from multipart/form-data and put them in req.body
  app.use(multerMiddleware);
  app.use(fromFilesToBodyMiddleware);

  // parse application/x-www-form-urlencoded and put it in req.body
  app.use(express.urlencoded({ extended: true }));

  app.use(loggerMiddleware(serviceName));

  app.use(
    appBasePath,
    healthRouter,
    swaggerRouter,
    contextMiddleware(serviceName, false),
    await applicationAuditBeginMiddleware(serviceName, config),
    await applicationAuditEndMiddleware(serviceName, config),
    await applicationAuditEndSessionTokenExchangeMiddleware(
      serviceName,
      config
    ),
    authorizationRouter(zodiosCtx, services.authorizationService),
    emailDeeplinkRouter(
      zodiosCtx,
      clients.tenantProcessClient,
      interopTokenGenerator
    ),
    authenticationMiddleware(config),
    uiAuthDataValidationMiddleware(),
    // Authenticated routes (rate limiter & authorization middlewares rely on auth data to work)
    rateLimiterMiddleware,
    agreementRouter(zodiosCtx, services.agreementService),
    attributeRouter(zodiosCtx, services.attributeService),
    catalogRouter(zodiosCtx, services.catalogService),
    clientRouter(zodiosCtx, services.clientService),
    consumerDelegationRouter(zodiosCtx, services.delegationService),
    delegationRouter(zodiosCtx, services.delegationService),
    eserviceTemplateRouter(zodiosCtx, services.eServiceTemplateService),
    notificationConfigRouter(zodiosCtx, services.notificationConfigService),
    inAppNotificationRouter(zodiosCtx, services.inAppNotificationService),
    privacyNoticeRouter(zodiosCtx, services.privacyNoticeService),
    producerDelegationRouter(zodiosCtx, services.delegationService),
    producerKeychainRouter(zodiosCtx, services.producerKeychainService),
    purposeRouter(zodiosCtx, services.purposeService),
    purposeTemplateRouter(zodiosCtx, services.purposeTemplateService),
    purposeTemplateRouter(zodiosCtx, services.purposeTemplateService),
    selfcareRouter(zodiosCtx, services.selfcareService),
    supportRouter(zodiosCtx, services.authorizationServiceForSupport),
    tenantRouter(zodiosCtx, services.tenantService),
    toolRouter(zodiosCtx, services.toolsService)
  );

  app.use(errorsToApiProblemsMiddleware);

  return app;
}
