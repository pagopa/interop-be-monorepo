import {
  APIEndpoint,
  ApplicationAuditProducerConfig,
  CommonHTTPServiceConfig,
  DPoPConfig,
  FileManagerConfig,
  JWTConfig,
  RedisRateLimiterConfig,
  SelfCareClientConfig,
  IntegrityRest02SignatureConfig,
  TenantProcessServerConfig,
  AgreementProcessServerConfig,
  CatalogProcessServerConfig,
  AttributeRegistryProcessServerConfig,
  PurposeProcessServerConfig,
  AuthorizationProcessServerConfig,
  DelegationProcessServerConfig,
  EServiceTemplateProcessServerConfig,
  PurposeTemplateProcessServerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const AgreementConsumerDocumentsConfig = z
  .object({
    AGREEMENT_CONSUMER_DOCUMENTS_PATH: z.string(),
    AGREEMENT_CONSUMER_CONTRACTS_PATH: z.string(),
    AGREEMENT_CONSUMER_DOCUMENTS_CONTAINER: z.string(),
  })
  .transform((c) => ({
    agreementConsumerDocumentsPath: c.AGREEMENT_CONSUMER_DOCUMENTS_PATH,
    agreementConsumerContractsPath: c.AGREEMENT_CONSUMER_CONTRACTS_PATH,
    agreementConsumerDocumentsContainer:
      c.AGREEMENT_CONSUMER_DOCUMENTS_CONTAINER,
  }));

const EServiceDocumentsConfig = z
  .object({
    ESERVICE_DOCUMENTS_CONTAINER: z.string(),
    ESERVICE_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    eserviceDocumentsContainer: c.ESERVICE_DOCUMENTS_CONTAINER,
    eserviceDocumentsPath: c.ESERVICE_DOCUMENTS_PATH,
  }));

const RiskAnalysisDocumentsConfig = z
  .object({
    RISK_ANALYSIS_DOCUMENTS_CONTAINER: z.string(),
    RISK_ANALYSIS_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    riskAnalysisDocumentsContainer: c.RISK_ANALYSIS_DOCUMENTS_CONTAINER,
    riskAnalysisDocumentsPath: c.RISK_ANALYSIS_DOCUMENTS_PATH,
  }));

const EServiceTemplateDocumentsConfig = z
  .object({
    ESERVICE_TEMPLATE_DOCUMENTS_CONTAINER: z.string(),
    ESERVICE_TEMPLATE_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    eserviceTemplateDocumentsContainer: c.ESERVICE_TEMPLATE_DOCUMENTS_CONTAINER,
    eserviceTemplateDocumentsPath: c.ESERVICE_TEMPLATE_DOCUMENTS_PATH,
  }));

const PurposeTemplateDocumentsConfig = z
  .object({
    PURPOSE_TEMPLATE_DOCUMENTS_CONTAINER: z.string(),
    PURPOSE_TEMPLATE_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    purposeTemplateDocumentsContainer: c.PURPOSE_TEMPLATE_DOCUMENTS_CONTAINER,
    purposeTemplateDocumentsPath: c.PURPOSE_TEMPLATE_DOCUMENTS_PATH,
  }));

const EventManagerServerConfig = z
  .object({
    EVENT_MANAGER_URL: APIEndpoint,
  })
  .transform((c) => ({
    eventManagerUrl: c.EVENT_MANAGER_URL,
  }));
type EventManagerServerConfig = z.infer<typeof EventManagerServerConfig>;

const M2MGatewayConfigV3 = CommonHTTPServiceConfig.and(
  TenantProcessServerConfig
)
  .and(AgreementProcessServerConfig)
  .and(AgreementConsumerDocumentsConfig)
  .and(CatalogProcessServerConfig)
  .and(EServiceDocumentsConfig)
  .and(AttributeRegistryProcessServerConfig)
  .and(PurposeProcessServerConfig)
  .and(RiskAnalysisDocumentsConfig)
  .and(RedisRateLimiterConfig)
  .and(AuthorizationProcessServerConfig)
  .and(DelegationProcessServerConfig)
  .and(EServiceTemplateProcessServerConfig)
  .and(EServiceTemplateDocumentsConfig)
  .and(EventManagerServerConfig)
  .and(PurposeTemplateProcessServerConfig)
  .and(PurposeTemplateDocumentsConfig)
  .and(SelfCareClientConfig)
  .and(ApplicationAuditProducerConfig)
  .and(FileManagerConfig)
  .and(DPoPConfig)
  .and(JWTConfig)
  .and(IntegrityRest02SignatureConfig)
  .and(
    z
      .object({
        M2M_GATEWAY_INTERFACE_VERSION: z.string(),
        MAX_FILE_SIZE_BYTES: z.coerce.number().default(10 * 1024 * 1024),
        MAX_INTERFACE_FILE_SIZE_BYTES: z.coerce
          .number()
          .default(3 * 1024 * 1024),
        DEFAULT_POLLING_RETRY_DELAY: z.coerce.number().default(1000),
        DEFAULT_POLLING_MAX_RETRIES: z.coerce.number().default(5),
      })
      .transform((c) => ({
        m2mGatewayInterfaceVersion: c.M2M_GATEWAY_INTERFACE_VERSION,
        maxFileSizeBytes: c.MAX_FILE_SIZE_BYTES,
        maxInterfaceFileSizeBytes: c.MAX_INTERFACE_FILE_SIZE_BYTES,
        defaultPollingRetryDelay: c.DEFAULT_POLLING_RETRY_DELAY,
        defaultPollingMaxRetries: c.DEFAULT_POLLING_MAX_RETRIES,
      }))
  );

type M2MGatewayConfigV3 = z.infer<typeof M2MGatewayConfigV3>;
export const config: M2MGatewayConfigV3 = M2MGatewayConfigV3.parse(process.env);
