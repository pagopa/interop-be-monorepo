import {
  APIEndpoint,
  CommonHTTPServiceConfig,
  FileManagerConfig,
  RedisRateLimiterConfig,
  SelfCareConfig,
  SessionTokenGenerationConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";
import { ClientAssertionValidationConfig } from "pagopa-interop-client-assertion-validation";

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
    CONSUMER_DOCUMENTS_PATH: z.string(),
    CONSUMER_DOCUMENTS_CONTAINER: z.string(),
  })
  .transform((c) => ({
    agreementProcessUrl: c.AGREEMENT_PROCESS_URL,
    consumerDocumentsPath: c.CONSUMER_DOCUMENTS_PATH,
    consumerDocumentsContainer: c.CONSUMER_DOCUMENTS_CONTAINER,
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
    RISK_ANALYSIS_DOCUMENTS_CONTAINER: z.string(),
  })
  .transform((c) => ({
    purposeUrl: c.PURPOSE_PROCESS_URL,
    riskAnalysisDocumentsContainer: c.RISK_ANALYSIS_DOCUMENTS_CONTAINER,
  }));
export type PurposeProcessServerConfig = z.infer<
  typeof PurposeProcessServerConfig
>;

export const AuthorizationProcessServerConfig = z
  .object({
    AUTHORIZATION_PROCESS_URL: APIEndpoint,
    TENANT_ALLOWED_ORIGINS: z.string(),
    SAML_AUDIENCE: z.string(),
    PAGOPA_TENANT_ID: z.string(),
    SAML_CALLBACK_URL: z.string().url(),
    SAML_CALLBACK_ERROR_URL: z.string().url(),
    SUPPORT_LANDING_TOKEN_DURATION_SECONDS: z.coerce.number().default(300),
    SUPPORT_TOKEN_DURATION_SECONDS: z.coerce.number().default(3600),
    SAML_PUBLIC_KEY: z.string(),
  })
  .transform((c) => ({
    authorizationUrl: c.AUTHORIZATION_PROCESS_URL,
    tenantAllowedOrigins: c.TENANT_ALLOWED_ORIGINS.split(","),
    samlAudience: c.SAML_AUDIENCE,
    pagoPaTenantId: c.PAGOPA_TENANT_ID,
    samlCallbackUrl: c.SAML_CALLBACK_URL,
    samlCallbackErrorUrl: c.SAML_CALLBACK_ERROR_URL,
    supportLandingJwtDuration: c.SUPPORT_LANDING_TOKEN_DURATION_SECONDS,
    supportJwtDuration: c.SUPPORT_TOKEN_DURATION_SECONDS,
    samlPublicKey: c.SAML_PUBLIC_KEY,
  }));
export type AuthorizationProcessServerConfig = z.infer<
  typeof AuthorizationProcessServerConfig
>;

export const DelegationProcessServerConfig = z
  .object({
    DELEGATION_PROCESS_URL: APIEndpoint,
    DELEGATION_CONTRACTS_CONTAINER: z.string(),
  })
  .transform((c) => ({
    delegationProcessUrl: c.DELEGATION_PROCESS_URL,
    delegationContractsContainer: c.DELEGATION_CONTRACTS_CONTAINER,
  }));
export type DelegationProcessServerConfig = z.infer<
  typeof DelegationProcessServerConfig
>;

export const S3PrivacyNoticeConfig = z
  .object({
    PRIVACY_NOTICES_CONTAINER: z.string(),
    PRIVACY_NOTICES_PATH: z.string(),
    PRIVACY_NOTICES_TOS_FILE_NAME: z.string(),
    PRIVACY_NOTICES_PP_FILE_NAME: z.string(),
  })
  .transform((c) => ({
    privacyNoticesContainer: c.PRIVACY_NOTICES_CONTAINER,
    privacyNoticesPath: c.PRIVACY_NOTICES_PATH,
    privacyNoticesTOSFileName: c.PRIVACY_NOTICES_TOS_FILE_NAME,
    privacyNoticesPPFileName: c.PRIVACY_NOTICES_PP_FILE_NAME,
  }));
export type S3PrivacyNoticeConfig = z.infer<typeof S3PrivacyNoticeConfig>;

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
export type PrivactNoticeConfig = z.infer<typeof PrivactNoticeConfig>;

export const AllowListConfig = z
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
export type AllowListConfig = z.infer<typeof AllowListConfig>;

export const ExportFileConfig = z
  .object({
    EXPORT_ESERVICE_CONTAINER: z.string(),
    EXPORT_ESERVICE_PATH: z.string(),
    PRESIGNED_URL_GET_DURATION_MINUTES: z.coerce.number(),
  })
  .transform((c) => ({
    exportEserviceContainer: c.EXPORT_ESERVICE_CONTAINER,
    exportEservicePath: c.EXPORT_ESERVICE_PATH,
    presignedUrlGetDurationMinutes: c.PRESIGNED_URL_GET_DURATION_MINUTES,
  }));
export type ExportFileConfig = z.infer<typeof ExportFileConfig>;

export const ImportFileConfig = z
  .object({
    IMPORT_ESERVICE_CONTAINER: z.string(),
    IMPORT_ESERVICE_PATH: z.string(),
    PRESIGNED_URL_PUT_DURATION_MINUTES: z.coerce.number(),
  })
  .transform((c) => ({
    importEserviceContainer: c.IMPORT_ESERVICE_CONTAINER,
    importEservicePath: c.IMPORT_ESERVICE_PATH,
    presignedUrlPutDurationMinutes: c.PRESIGNED_URL_PUT_DURATION_MINUTES,
  }));
export type ImportFileConfig = z.infer<typeof ImportFileConfig>;

export const InterfaceVersion = z
  .object({
    BACKEND_FOR_FRONTEND_INTERFACE_VERSION: z.string(),
  })
  .transform((c) => ({
    backendForFrontendInterfaceVersion:
      c.BACKEND_FOR_FRONTEND_INTERFACE_VERSION,
  }));
const BffProcessConfig = CommonHTTPServiceConfig.and(TenantProcessServerConfig)
  .and(AgreementProcessServerConfig)
  .and(CatalogProcessServerConfig)
  .and(AttributeRegistryProcessServerConfig)
  .and(SelfCareConfig)
  .and(PurposeProcessServerConfig)
  .and(RedisRateLimiterConfig)
  .and(AuthorizationProcessServerConfig)
  .and(DelegationProcessServerConfig)
  .and(TokenGenerationConfig)
  .and(SessionTokenGenerationConfig)
  .and(FileManagerConfig)
  .and(AllowListConfig)
  .and(PrivactNoticeConfig)
  .and(S3PrivacyNoticeConfig)
  .and(ExportFileConfig)
  .and(ImportFileConfig)
  .and(InterfaceVersion)
  .and(ClientAssertionValidationConfig);

export type BffProcessConfig = z.infer<typeof BffProcessConfig>;
export const config: BffProcessConfig = BffProcessConfig.parse(process.env);
