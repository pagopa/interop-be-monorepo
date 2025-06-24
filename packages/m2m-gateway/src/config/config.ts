import {
  APIEndpoint,
  ApplicationAuditProducerConfig,
  CommonHTTPServiceConfig,
  FileManagerConfig,
  RedisRateLimiterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const TenantProcessServerConfig = z
  .object({
    TENANT_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    tenantProcessUrl: c.TENANT_PROCESS_URL,
  }));
export type TenantProcessServerConfig = z.infer<
  typeof TenantProcessServerConfig
>;

export const AgreementProcessServerConfig = z
  .object({
    AGREEMENT_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    agreementProcessUrl: c.AGREEMENT_PROCESS_URL,
  }));
export type AgreementProcessServerConfig = z.infer<
  typeof AgreementProcessServerConfig
>;

export const CatalogProcessServerConfig = z
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
export type CatalogProcessServerConfig = z.infer<
  typeof CatalogProcessServerConfig
>;

export const AttributeRegistryProcessServerConfig = z
  .object({
    ATTRIBUTE_REGISTRY_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    attributeRegistryUrl: c.ATTRIBUTE_REGISTRY_PROCESS_URL,
  }));
export type AttributeRegistryProcessServerConfig = z.infer<
  typeof AttributeRegistryProcessServerConfig
>;

export const PurposeProcessServerConfig = z
  .object({
    PURPOSE_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    purposeUrl: c.PURPOSE_PROCESS_URL,
  }));
export type PurposeProcessServerConfig = z.infer<
  typeof PurposeProcessServerConfig
>;

export const AuthorizationProcessServerConfig = z
  .object({
    AUTHORIZATION_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    authorizationUrl: c.AUTHORIZATION_PROCESS_URL,
  }));
export type AuthorizationProcessServerConfig = z.infer<
  typeof AuthorizationProcessServerConfig
>;

export const DelegationProcessServerConfig = z
  .object({
    DELEGATION_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    delegationProcessUrl: c.DELEGATION_PROCESS_URL,
  }));
export type DelegationProcessServerConfig = z.infer<
  typeof DelegationProcessServerConfig
>;

export const EServiceTemplateProcessServerConfig = z
  .object({
    ESERVICE_TEMPLATE_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    eserviceTemplateProcessUrl: c.ESERVICE_TEMPLATE_PROCESS_URL,
  }));
export type EServiceTemplateProcessServerConfig = z.infer<
  typeof EServiceTemplateProcessServerConfig
>;

const M2MGatewayConfig = CommonHTTPServiceConfig.and(TenantProcessServerConfig)
  .and(AgreementProcessServerConfig)
  .and(CatalogProcessServerConfig)
  .and(AttributeRegistryProcessServerConfig)
  .and(PurposeProcessServerConfig)
  .and(RedisRateLimiterConfig)
  .and(AuthorizationProcessServerConfig)
  .and(DelegationProcessServerConfig)
  .and(EServiceTemplateProcessServerConfig)
  .and(ApplicationAuditProducerConfig)
  .and(FileManagerConfig)
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

export type M2MGatewayConfig = z.infer<typeof M2MGatewayConfig>;
export const config: M2MGatewayConfig = M2MGatewayConfig.parse(process.env);
