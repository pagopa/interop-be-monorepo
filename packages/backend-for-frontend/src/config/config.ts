import {
  APIEndpoint,
  ApplicationAuditProducerConfig,
  CommonHTTPServiceConfig,
  FeatureFlagAgreementApprovalPolicyUpdateConfig,
  FeatureFlagClientAssertionStrictClaimsValidationConfig,
  FeatureFlagNotificationConfig,
  FeatureFlagPurposeTemplateConfig,
  FeatureFlagUseSignedDocumentConfig,
  FileManagerConfig,
  RedisRateLimiterConfig,
  SelfCareClientConfig,
  SessionTokenGenerationConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";
import { ClientAssertionValidationConfig } from "pagopa-interop-client-assertion-validation";

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
    CONSUMER_DOCUMENTS_PATH: z.string(),
    CONSUMER_DOCUMENTS_CONTAINER: z.string(),
    CONSUMER_SIGNED_DOCUMENTS_CONTAINER: z.string(),
  })
  .transform((c) => ({
    agreementProcessUrl: c.AGREEMENT_PROCESS_URL,
    consumerDocumentsPath: c.CONSUMER_DOCUMENTS_PATH,
    consumerDocumentsContainer: c.CONSUMER_DOCUMENTS_CONTAINER,
    consumerSignedDocumentsContainer: c.CONSUMER_SIGNED_DOCUMENTS_CONTAINER,
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
    RISK_ANALYSIS_SIGNED_DOCUMENTS_CONTAINER: z.string(),
    RISK_ANALYSIS_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    purposeUrl: c.PURPOSE_PROCESS_URL,
    riskAnalysisDocumentsContainer: c.RISK_ANALYSIS_DOCUMENTS_CONTAINER,
    riskAnalysisDocumentsPath: c.RISK_ANALYSIS_DOCUMENTS_PATH,
    riskAnalysisSignedDocumentsContainer:
      c.RISK_ANALYSIS_SIGNED_DOCUMENTS_CONTAINER,
  }));
type PurposeProcessServerConfig = z.infer<typeof PurposeProcessServerConfig>;

const PurposeTemplateProcessServerConfig = z
  .object({
    PURPOSE_TEMPLATE_PROCESS_URL: APIEndpoint,
    PURPOSE_TEMPLATE_DOCUMENTS_CONTAINER: z.string(),
    PURPOSE_TEMPLATE_DOCUMENTS_PATH: z.string(),
    RISK_ANALYSIS_TEMPLATE_DOCUMENTS_CONTAINER: z.string(),
    RISK_ANALYSIS_TEMPLATE_SIGNED_DOCUMENTS_CONTAINER: z.string(),
    RISK_ANALYSIS_TEMPLATE_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    purposeTemplateUrl: c.PURPOSE_TEMPLATE_PROCESS_URL,
    purposeTemplateDocumentsContainer: c.PURPOSE_TEMPLATE_DOCUMENTS_CONTAINER,
    purposeTemplateDocumentsPath: c.PURPOSE_TEMPLATE_DOCUMENTS_PATH,
    riskAnalysisTemplateDocumentsContainer:
      c.RISK_ANALYSIS_TEMPLATE_DOCUMENTS_CONTAINER,
    riskAnalysisTemplateDocumentsPath: c.RISK_ANALYSIS_TEMPLATE_DOCUMENTS_PATH,
    riskAnalysisTemplateSignedDocumentsContainer:
      c.RISK_ANALYSIS_TEMPLATE_SIGNED_DOCUMENTS_CONTAINER,
  }));
type PurposeTemplateProcessServerConfig = z.infer<
  typeof PurposeTemplateProcessServerConfig
>;

const AuthorizationProcessServerConfig = z
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
type AuthorizationProcessServerConfig = z.infer<
  typeof AuthorizationProcessServerConfig
>;

const DelegationProcessServerConfig = z
  .object({
    DELEGATION_PROCESS_URL: APIEndpoint,
    DELEGATION_CONTRACTS_CONTAINER: z.string(),
    DELEGATION_SIGNED_CONTRACTS_CONTAINER: z.string(),
  })
  .transform((c) => ({
    delegationProcessUrl: c.DELEGATION_PROCESS_URL,
    delegationContractsContainer: c.DELEGATION_CONTRACTS_CONTAINER,
    delegationSignedContractsContainer: c.DELEGATION_SIGNED_CONTRACTS_CONTAINER,
  }));
type DelegationProcessServerConfig = z.infer<
  typeof DelegationProcessServerConfig
>;

const EServiceTemplateProcessServerConfig = z
  .object({
    ESERVICE_TEMPLATE_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    eserviceTemplateProcessUrl: c.ESERVICE_TEMPLATE_PROCESS_URL,
  }));
type EServiceTemplateProcessServerConfig = z.infer<
  typeof EServiceTemplateProcessServerConfig
>;

const EServiceTemplateS3Config = z
  .object({
    ESERVICE_TEMPLATE_DOCUMENTS_CONTAINER: z.string(),
    ESERVICE_TEMPLATE_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    eserviceTemplateDocumentsContainer: c.ESERVICE_TEMPLATE_DOCUMENTS_CONTAINER,
    eserviceTemplateDocumentsPath: c.ESERVICE_TEMPLATE_DOCUMENTS_PATH,
  }));
type EServiceTemplateS3Config = z.infer<typeof EServiceTemplateS3Config>;

const S3PrivacyNoticeConfig = z
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
type S3PrivacyNoticeConfig = z.infer<typeof S3PrivacyNoticeConfig>;

const PrivacyNoticeConfig = z
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
type PrivacyNoticeConfig = z.infer<typeof PrivacyNoticeConfig>;

const AllowListConfig = z
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
type AllowListConfig = z.infer<typeof AllowListConfig>;

const ExportFileConfig = z
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
type ExportFileConfig = z.infer<typeof ExportFileConfig>;

const ImportFileConfig = z
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
type ImportFileConfig = z.infer<typeof ImportFileConfig>;

const InterfaceVersion = z
  .object({
    BACKEND_FOR_FRONTEND_INTERFACE_VERSION: z.string(),
  })
  .transform((c) => ({
    backendForFrontendInterfaceVersion:
      c.BACKEND_FOR_FRONTEND_INTERFACE_VERSION,
  }));

const SelfcareProcessConfig = z
  .object({
    INTEROP_SELFCARE_PRODUCT_NAME: z.string(),
  })
  .transform((c) => ({
    selfcareProductName: c.INTEROP_SELFCARE_PRODUCT_NAME,
  }));
type SelfcareProcessConfig = z.infer<typeof SelfcareProcessConfig>;

const NotificationConfigProcessServerConfig = z
  .object({
    NOTIFICATION_CONFIG_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    notificationConfigProcessUrl: c.NOTIFICATION_CONFIG_PROCESS_URL,
  }));
type NotificationConfigProcessServerConfig = z.infer<
  typeof NotificationConfigProcessServerConfig
>;

const InAppNotificationManagerServerConfig = z
  .object({
    IN_APP_NOTIFICATION_MANAGER_URL: APIEndpoint,
  })
  .transform((c) => ({
    inAppNotificationManagerUrl: c.IN_APP_NOTIFICATION_MANAGER_URL,
  }));
type InAppNotificationManagerServerConfig = z.infer<
  typeof InAppNotificationManagerServerConfig
>;

const FrontendBaseURLConfig = z
  .object({
    FRONTEND_BASE_URL: z.string().url(),
  })
  .transform((c) => ({
    frontendBaseUrl: c.FRONTEND_BASE_URL,
  }));
type FrontendBaseURLConfig = z.infer<typeof FrontendBaseURLConfig>;

const SwaggerConfig = z
  .object({
    BFF_SWAGGER_UI_ENABLED: z.coerce.boolean().default(false),
  })
  .transform((c) => ({
    bffSwaggerUiEnabled: c.BFF_SWAGGER_UI_ENABLED,
  }));
type SwaggerConfig = z.infer<typeof SwaggerConfig>;

const BffProcessConfig = CommonHTTPServiceConfig.and(TenantProcessServerConfig)
  .and(AgreementProcessServerConfig)
  .and(CatalogProcessServerConfig)
  .and(AttributeRegistryProcessServerConfig)
  .and(SelfCareClientConfig)
  .and(PurposeProcessServerConfig)
  .and(PurposeTemplateProcessServerConfig)
  .and(RedisRateLimiterConfig)
  .and(AuthorizationProcessServerConfig)
  .and(DelegationProcessServerConfig)
  .and(EServiceTemplateProcessServerConfig)
  .and(TokenGenerationConfig)
  .and(SessionTokenGenerationConfig)
  .and(FileManagerConfig)
  .and(AllowListConfig)
  .and(PrivacyNoticeConfig)
  .and(S3PrivacyNoticeConfig)
  .and(ExportFileConfig)
  .and(ImportFileConfig)
  .and(InterfaceVersion)
  .and(SelfcareProcessConfig)
  .and(NotificationConfigProcessServerConfig)
  .and(InAppNotificationManagerServerConfig)
  .and(SwaggerConfig)
  .and(ClientAssertionValidationConfig)
  .and(EServiceTemplateS3Config)
  .and(ApplicationAuditProducerConfig)
  .and(FeatureFlagAgreementApprovalPolicyUpdateConfig)
  .and(FeatureFlagClientAssertionStrictClaimsValidationConfig)
  .and(FeatureFlagNotificationConfig)
  .and(FrontendBaseURLConfig)
  .and(FeatureFlagPurposeTemplateConfig)
  .and(FeatureFlagUseSignedDocumentConfig);

export type BffProcessConfig = z.infer<typeof BffProcessConfig>;
export const config: BffProcessConfig = BffProcessConfig.parse(process.env);
