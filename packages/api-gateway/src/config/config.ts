import {
  APIEndpoint,
  CommonHTTPServiceConfig,
  RedisRateLimiterConfig,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
  CatalogProcessServerConfig,
  AgreementProcessServerConfig,
  TenantProcessServerConfig,
  PurposeProcessServerConfig,
  AttributeRegistryProcessServerConfig,
  AuthorizationProcessServerConfig,
  DelegationProcessServerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

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
