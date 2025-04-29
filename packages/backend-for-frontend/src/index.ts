import {
  InteropTokenGenerator,
  initFileManager,
  initRedisRateLimiter,
  rateLimiterMiddleware as rateLimiterMiddlewareBuilder,
  startServer,
} from "pagopa-interop-commons";
import {
  selfcareV2InstitutionClientBuilder,
  selfcareV2UsersClientBuilder,
} from "pagopa-interop-api-clients";
import { config } from "./config/config.js";
import { BFFServices, createApp, serviceName } from "./app.js";
import getAllowList from "./utilities/getAllowList.js";
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
  SelfcareService,
  selfcareServiceBuilder,
} from "./services/selfcareService.js";
import {
  TenantService,
  tenantServiceBuilder,
} from "./services/tenantService.js";
import { getInteropBeClients } from "./clients/clientsProvider.js";
import { ToolsService, toolsServiceBuilder } from "./services/toolService.js";

const fileManager = initFileManager(config);
const clients = getInteropBeClients();
const interopTokenGenerator = new InteropTokenGenerator(config);
const interopBeClients = getInteropBeClients();
const selfcareV2UsersClient = selfcareV2UsersClientBuilder(config);

const createDefaultAgreementService = (): AgreementService =>
  agreementServiceBuilder(clients, fileManager);

const createDefaultAttributeService = (): AttributeService =>
  attributeServiceBuilder(clients.attributeProcessClient);

const createDefaultAuthorizationService =
  async (): Promise<AuthorizationService> =>
    authorizationServiceBuilder(
      interopTokenGenerator,
      clients.tenantProcessClient,
      await getAllowList(serviceName, fileManager, config),
      redisRateLimiter
    );

const createDefaultAuthorizationServiceForSupportRouter =
  (): AuthorizationService =>
    authorizationServiceBuilder(
      interopTokenGenerator,
      clients.tenantProcessClient,
      config.tenantAllowedOrigins,
      redisRateLimiter
    );

const createDefaultClientService = (): ClientService =>
  clientServiceBuilder(interopBeClients, selfcareV2UsersClient);

const createDefaultCatalogService = (): CatalogService =>
  catalogServiceBuilder(
    clients.catalogProcessClient,
    clients.tenantProcessClient,
    clients.agreementProcessClient,
    clients.attributeProcessClient,
    clients.delegationProcessClient,
    clients.eserviceTemplateProcessClient,
    fileManager,
    config
  );

const createDefaultDelegationService = (): DelegationService =>
  delegationServiceBuilder(
    clients.delegationProcessClient,
    clients.tenantProcessClient,
    clients.catalogProcessClient,
    fileManager
  );

const createDefaultEServiceTemplateService = (): EServiceTemplateService =>
  eserviceTemplateServiceBuilder(
    clients.eserviceTemplateProcessClient,
    clients.tenantProcessClient,
    clients.attributeProcessClient,
    fileManager
  );

const createDefaultProducerKeychainService = (): ProducerKeychainService =>
  producerKeychainServiceBuilder(clients, selfcareV2UsersClient);

const createDefaultPurposeService = (): PurposeService =>
  purposeServiceBuilder(
    clients.purposeProcessClient,
    clients.catalogProcessClient,
    clients.tenantProcessClient,
    clients.agreementProcessClient,
    clients.delegationProcessClient,
    clients.authorizationClient,
    initFileManager(config)
  );

const createDefaultSelfcareService = (): SelfcareService =>
  selfcareServiceBuilder(
    selfcareV2InstitutionClientBuilder(config),
    selfcareV2UsersClientBuilder(config),
    clients.tenantProcessClient
  );

const createDefaultTenantService = (): TenantService =>
  tenantServiceBuilder(
    clients.tenantProcessClient,
    clients.attributeProcessClient,
    clients.selfcareV2InstitutionClient
  );

const createDefaultToolsService = (): ToolsService =>
  toolsServiceBuilder(clients);

const services: BFFServices = {
  agreementService: createDefaultAgreementService(),
  attributeService: createDefaultAttributeService(),
  authorizationService: await createDefaultAuthorizationService(),
  authorizationServiceForSupport:
    createDefaultAuthorizationServiceForSupportRouter(),
  catalogService: createDefaultCatalogService(),
  clientService: createDefaultClientService(),
  delegationService: createDefaultDelegationService(),
  eServiceTemplateService: createDefaultEServiceTemplateService(),
  producerKeychainService: createDefaultProducerKeychainService(),
  purposeService: createDefaultPurposeService(),
  selfcareService: createDefaultSelfcareService(),
  tenantService: createDefaultTenantService(),
  toolsService: createDefaultToolsService(),
};

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

startServer(await createApp(services, rateLimiterMiddleware), config);
