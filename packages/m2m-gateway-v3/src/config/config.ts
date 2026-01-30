import {
  APIEndpoint,
  ApplicationAuditProducerConfig,
  CommonHTTPServiceConfig,
  FileManagerConfig,
  RedisRateLimiterConfig,
  // TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const TenantProcessServerConfig = z
  .object({
    TENANT_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    tenantProcessUrl: c.TENANT_PROCESS_URL,
  }));
type TenantProcessServerConfig = z.infer<typeof TenantProcessServerConfig>;

const AgreementProcessServerConfig = z
  .object({
    AGREEMENT_PROCESS_URL: APIEndpoint,
    AGREEMENT_CONSUMER_DOCUMENTS_PATH: z.string(),
    AGREEMENT_CONSUMER_CONTRACTS_PATH: z.string(),
    AGREEMENT_CONSUMER_DOCUMENTS_CONTAINER: z.string(),
  })
  .transform((c) => ({
    agreementProcessUrl: c.AGREEMENT_PROCESS_URL,
    agreementConsumerDocumentsPath: c.AGREEMENT_CONSUMER_DOCUMENTS_PATH,
    agreementConsumerContractsPath: c.AGREEMENT_CONSUMER_CONTRACTS_PATH,
    agreementConsumerDocumentsContainer:
      c.AGREEMENT_CONSUMER_DOCUMENTS_CONTAINER,
  }));
type AgreementProcessServerConfig = z.infer<
  typeof AgreementProcessServerConfig
>;

const CatalogProcessServerConfig = z
  .object({
    CATALOG_PROCESS_URL: APIEndpoint,
    ESERVICE_DOCUMENTS_CONTAINER: z.string(),
    ESERVICE_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    catalogProcessUrl: c.CATALOG_PROCESS_URL,
    eserviceDocumentsContainer: c.ESERVICE_DOCUMENTS_CONTAINER,
    eserviceDocumentsPath: c.ESERVICE_DOCUMENTS_PATH,
  }));
type CatalogProcessServerConfig = z.infer<typeof CatalogProcessServerConfig>;

const AttributeRegistryProcessServerConfig = z
  .object({
    ATTRIBUTE_REGISTRY_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    attributeRegistryUrl: c.ATTRIBUTE_REGISTRY_PROCESS_URL,
  }));
type AttributeRegistryProcessServerConfig = z.infer<
  typeof AttributeRegistryProcessServerConfig
>;

const PurposeProcessServerConfig = z
  .object({
    PURPOSE_PROCESS_URL: APIEndpoint,
    RISK_ANALYSIS_DOCUMENTS_CONTAINER: z.string(),
    RISK_ANALYSIS_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    purposeUrl: c.PURPOSE_PROCESS_URL,
    riskAnalysisDocumentsContainer: c.RISK_ANALYSIS_DOCUMENTS_CONTAINER,
    riskAnalysisDocumentsPath: c.RISK_ANALYSIS_DOCUMENTS_PATH,
  }));
type PurposeProcessServerConfig = z.infer<typeof PurposeProcessServerConfig>;

const AuthorizationProcessServerConfig = z
  .object({
    AUTHORIZATION_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    authorizationUrl: c.AUTHORIZATION_PROCESS_URL,
  }));
type AuthorizationProcessServerConfig = z.infer<
  typeof AuthorizationProcessServerConfig
>;

const DelegationProcessServerConfig = z
  .object({
    DELEGATION_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    delegationProcessUrl: c.DELEGATION_PROCESS_URL,
  }));
type DelegationProcessServerConfig = z.infer<
  typeof DelegationProcessServerConfig
>;

const EServiceTemplateProcessServerConfig = z
  .object({
    ESERVICE_TEMPLATE_PROCESS_URL: APIEndpoint,
    ESERVICE_TEMPLATE_DOCUMENTS_CONTAINER: z.string(),
    ESERVICE_TEMPLATE_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    eserviceTemplateProcessUrl: c.ESERVICE_TEMPLATE_PROCESS_URL,
    eserviceTemplateDocumentsContainer: c.ESERVICE_TEMPLATE_DOCUMENTS_CONTAINER,
    eserviceTemplateDocumentsPath: c.ESERVICE_TEMPLATE_DOCUMENTS_PATH,
  }));
type EServiceTemplateProcessServerConfig = z.infer<
  typeof EServiceTemplateProcessServerConfig
>;

const EventManagerServerConfig = z
  .object({
    EVENT_MANAGER_URL: APIEndpoint,
  })
  .transform((c) => ({
    eventManagerUrl: c.EVENT_MANAGER_URL,
  }));
type EventManagerServerConfig = z.infer<typeof EventManagerServerConfig>;
const PurposeTemplateProcessServerConfig = z
  .object({
    PURPOSE_TEMPLATE_PROCESS_URL: APIEndpoint,
    PURPOSE_TEMPLATE_DOCUMENTS_CONTAINER: z.string(),
    PURPOSE_TEMPLATE_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    purposeTemplateProcessUrl: c.PURPOSE_TEMPLATE_PROCESS_URL,
    purposeTemplateDocumentsContainer: c.PURPOSE_TEMPLATE_DOCUMENTS_CONTAINER,
    purposeTemplateDocumentsPath: c.PURPOSE_TEMPLATE_DOCUMENTS_PATH,
  }));
type PurposeTemplateProcessServerConfig = z.infer<
  typeof PurposeTemplateProcessServerConfig
>;

export const SelfcareV2ServerConfig = z
  .object({
    SELFCARE_V2_URL: APIEndpoint,
  })
  .transform((c) => ({
    selfcareV2Url: c.SELFCARE_V2_URL,
  }));
export type SelfcareV2ServerConfig = z.infer<typeof SelfcareV2ServerConfig>;

const TokenGenerationConfig = z
  .object({
    GENERATED_INTEROP_TOKEN_ALGORITHM: z.string(),
    GENERATED_INTEROP_TOKEN_KID: z.string(),
    GENERATED_INTEROP_TOKEN_ISSUER: z.string(),
    GENERATED_INTEROP_TOKEN_M2M_AUDIENCE: z.string(),
    GENERATED_INTEROP_TOKEN_M2M_DURATION_SECONDS: z.coerce.number(),
    GENERATED_INTEROP_TOKEN_SUBJECT: z.string(),
  })
  .transform((c) => ({
    algorithm: c.GENERATED_INTEROP_TOKEN_ALGORITHM,
    kid: c.GENERATED_INTEROP_TOKEN_KID,
    issuer: c.GENERATED_INTEROP_TOKEN_ISSUER,
    audience: c.GENERATED_INTEROP_TOKEN_M2M_AUDIENCE.split(","),
    secondsDuration: c.GENERATED_INTEROP_TOKEN_M2M_DURATION_SECONDS,
    subject: c.GENERATED_INTEROP_TOKEN_SUBJECT,
  }));
type TokenGenerationConfig = z.infer<typeof TokenGenerationConfig>;

const M2MGatewayConfigV3 = CommonHTTPServiceConfig.and(
  TenantProcessServerConfig
)
  .and(AgreementProcessServerConfig)
  .and(CatalogProcessServerConfig)
  .and(AttributeRegistryProcessServerConfig)
  .and(PurposeProcessServerConfig)
  .and(RedisRateLimiterConfig)
  .and(AuthorizationProcessServerConfig)
  .and(DelegationProcessServerConfig)
  .and(EServiceTemplateProcessServerConfig)
  .and(EventManagerServerConfig)
  .and(PurposeTemplateProcessServerConfig)
  .and(SelfcareV2ServerConfig)
  .and(ApplicationAuditProducerConfig)
  .and(FileManagerConfig)
  // .and(DPoPConfig)
  // .and(JWTConfig)
  .and(TokenGenerationConfig)
  .and(
    z
      .object({
        M2M_GATEWAY_INTERFACE_VERSION: z.string(),
        DEFAULT_POLLING_RETRY_DELAY: z.coerce.number().default(1000),
        DEFAULT_POLLING_MAX_RETRIES: z.coerce.number().default(5),
      })
      .transform((c) => ({
        m2mGatewayInterfaceVersion: c.M2M_GATEWAY_INTERFACE_VERSION,
        defaultPollingRetryDelay: c.DEFAULT_POLLING_RETRY_DELAY,
        defaultPollingMaxRetries: c.DEFAULT_POLLING_MAX_RETRIES,
      }))
  );

type M2MGatewayConfigV3 = z.infer<typeof M2MGatewayConfigV3>;
export const config: M2MGatewayConfigV3 = M2MGatewayConfigV3.parse(process.env);
