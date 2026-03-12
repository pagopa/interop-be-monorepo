import { z } from "zod";
import {
  APIEndpoint,
  CommonHTTPServiceConfig,
  RedisRateLimiterConfig,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";

const CatalogProcessServerConfig = z
  .object({
    CATALOG_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    catalogProcessUrl: c.CATALOG_PROCESS_URL,
  }));
type CatalogProcessServerConfig = z.infer<typeof CatalogProcessServerConfig>;

const AgreementProcessServerConfig = z
  .object({
    AGREEMENT_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    agreementProcessUrl: c.AGREEMENT_PROCESS_URL,
  }));
type AgreementProcessServerConfig = z.infer<
  typeof AgreementProcessServerConfig
>;

const TenantProcessServerConfig = z
  .object({
    TENANT_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    tenantProcessUrl: c.TENANT_PROCESS_URL,
  }));
type TenantProcessServerConfig = z.infer<typeof TenantProcessServerConfig>;

const PurposeProcessServerConfig = z
  .object({
    PURPOSE_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    purposeProcessUrl: c.PURPOSE_PROCESS_URL,
  }));
type PurposeProcessServerConfig = z.infer<typeof PurposeProcessServerConfig>;

const AttributeRegistryProcessServerConfig = z
  .object({
    ATTRIBUTE_REGISTRY_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    attributeRegistryProcessUrl: c.ATTRIBUTE_REGISTRY_PROCESS_URL,
  }));
type AttributeRegistryProcessServerConfig = z.infer<
  typeof AttributeRegistryProcessServerConfig
>;

const AuthorizationProcessServerConfig = z
  .object({
    AUTHORIZATION_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    authorizationProcessUrl: c.AUTHORIZATION_PROCESS_URL,
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

const NotifierServerConfig = z
  .object({
    NOTIFIER_URL: APIEndpoint,
  })
  .transform((c) => ({
    notifierUrl: c.NOTIFIER_URL,
  }));
type NotifierServerConfig = z.infer<typeof NotifierServerConfig>;

const InterfaceVersion = z
  .object({
    API_GATEWAY_INTERFACE_VERSION: z.string(),
  })
  .transform((c) => ({
    apiGatewayInterfaceVersion: c.API_GATEWAY_INTERFACE_VERSION,
  }));
type InterfaceVersion = z.infer<typeof InterfaceVersion>;

const ApiGatewayConfig = CommonHTTPServiceConfig.and(RedisRateLimiterConfig)
  .and(InterfaceVersion)
  .and(CatalogProcessServerConfig)
  .and(AgreementProcessServerConfig)
  .and(TenantProcessServerConfig)
  .and(PurposeProcessServerConfig)
  .and(AuthorizationProcessServerConfig)
  .and(DelegationProcessServerConfig)
  .and(AttributeRegistryProcessServerConfig)
  .and(NotifierServerConfig)
  .and(ReadModelSQLDbConfig)
  .and(ApplicationAuditProducerConfig);
type ApiGatewayConfig = z.infer<typeof ApiGatewayConfig>;

export const config: ApiGatewayConfig = ApiGatewayConfig.parse(process.env);
