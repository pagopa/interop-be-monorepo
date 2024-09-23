import { z } from "zod";
import {
  APIEndpoint,
  CommonHTTPServiceConfig,
  RedisRateLimiterConfig,
  ReadModelDbConfig,
} from "pagopa-interop-commons";

export const CatalogProcessServerConfig = z
  .object({
    CATALOG_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    catalogProcessUrl: c.CATALOG_PROCESS_URL,
  }));
export type CatalogProcessServerConfig = z.infer<
  typeof CatalogProcessServerConfig
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

export const PurposeProcessServerConfig = z
  .object({
    PURPOSE_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    purposeProcessUrl: c.PURPOSE_PROCESS_URL,
  }));
export type PurposeProcessServerConfig = z.infer<
  typeof PurposeProcessServerConfig
>;

export const AttributeRegistryProcessServerConfig = z
  .object({
    ATTRIBUTE_REGISTRY_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    attributeRegistryProcessUrl: c.ATTRIBUTE_REGISTRY_PROCESS_URL,
  }));
export type AttributeRegistryProcessServerConfig = z.infer<
  typeof AttributeRegistryProcessServerConfig
>;

export const AuthorizationProcessServerConfig = z
  .object({
    AUTHORIZATION_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    authorizationProcessUrl: c.AUTHORIZATION_PROCESS_URL,
  }));
export type AuthorizationProcessServerConfig = z.infer<
  typeof AuthorizationProcessServerConfig
>;

const ApiGatewayConfig = CommonHTTPServiceConfig.and(RedisRateLimiterConfig)
  .and(CatalogProcessServerConfig)
  .and(AgreementProcessServerConfig)
  .and(TenantProcessServerConfig)
  .and(PurposeProcessServerConfig)
  .and(AuthorizationProcessServerConfig)
  .and(AttributeRegistryProcessServerConfig)
  .and(ReadModelDbConfig);
export type ApiGatewayConfig = z.infer<typeof ApiGatewayConfig>;

export const config: ApiGatewayConfig = ApiGatewayConfig.parse(process.env);
