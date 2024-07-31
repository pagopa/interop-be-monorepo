import { z } from "zod";
import {
  APIEndpoint,
  CommonHTTPServiceConfig,
  FileManagerConfig,
  SelfCareConfig,
  SessionTokenGenerationConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";

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
  })
  .transform((c) => ({
    catalogProcessUrl: c.CATALOG_PROCESS_URL,
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
    TENANT_ALLOWED_ORIGINS: z.string(),
    AUTHORIZATION_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    tenantAllowedOrigins: c.TENANT_ALLOWED_ORIGINS.split(","),
    authorizationUrl: c.AUTHORIZATION_PROCESS_URL,
  }));
export type AuthorizationProcessServerConfig = z.infer<
  typeof AuthorizationProcessServerConfig
>;

export const S3Config = z
  .object({
    PRIVACY_NOTICES_CONTAINER: z.string(),
    PRIVACY_NOTICES_PATH: z.string(),
    PRIVACY_NOTICES_FILE_NAME: z.string(),
  })
  .transform((c) => ({
    privacyNoticesContainer: c.PRIVACY_NOTICES_CONTAINER,
    privacyNoticesPath: c.PRIVACY_NOTICES_PATH,
    privacyNoticesFileName: c.PRIVACY_NOTICES_FILE_NAME,
  }));

export const PrivactNoticeConfig = z
  .object({
    PRIVACY_NOTICES_TOS_UUID: z.string(),
    PRIVACY_NOTICES_PP_UUID: z.string(),
    PRIVACY_NOTICES_DYNAMO_TABLE_NAME: z.string(),
    PRIVACY_NOTICES_USERS_DYNAMO_TABLE_NAME: z.string(),
  })
  .transform((c) => ({
    privacyNoticesTosUuid: c.PRIVACY_NOTICES_TOS_UUID,
    privacyNoticesPpUuid: c.PRIVACY_NOTICES_PP_UUID,
    privacyNoticesDynamoTableName: c.PRIVACY_NOTICES_DYNAMO_TABLE_NAME,
    privacyNoticesUsersDynamoTableName:
      c.PRIVACY_NOTICES_USERS_DYNAMO_TABLE_NAME,
  }));

export const AllowedListConfig = z
  .object({
    ALLOW_LIST_CONTAINER: z.string(),
    ALLOW_LIST_PATH: z.string(),
    ALLOW_LIST_FILE_NAME: z.string(),
  })
  .transform((c) => ({
    allowListContainer: c.ALLOW_LIST_CONTAINER,
    allowListPath: c.ALLOW_LIST_PATH,
    allowListFileName: c.ALLOW_LIST_FILE_NAME,
  }));

const BffProcessConfig = CommonHTTPServiceConfig.and(TenantProcessServerConfig)
  .and(AgreementProcessServerConfig)
  .and(CatalogProcessServerConfig)
  .and(AttributeRegistryProcessServerConfig)
  .and(SelfCareConfig)
  .and(PurposeProcessServerConfig)
  .and(AuthorizationProcessServerConfig)
  .and(TokenGenerationConfig)
  .and(SessionTokenGenerationConfig)
  .and(FileManagerConfig)
  .and(AllowedListConfig)
  .and(SelfCareConfig)
  .and(PrivactNoticeConfig)
  .and(FileManagerConfig)
  .and(S3Config);

export type BffProcessConfig = z.infer<typeof BffProcessConfig>;
export const config: BffProcessConfig = BffProcessConfig.parse(process.env);
