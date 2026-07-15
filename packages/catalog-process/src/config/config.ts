import {
  ApplicationAuditProducerConfig,
  CommonHTTPServiceConfig,
  EventStoreConfig,
  FeatureFlagAgreementApprovalPolicyUpdateConfig,
  FeatureFlagAsyncExchangeConfig,
  FeatureFlagAttributeCertifiedDiscreteConfig,
  FeatureFlagTenantKindInRiskAnalysisConfig,
  FileManagerConfig,
  ReadModelSQLDbConfig,
  S3Config,
  TenantKindHistoryDBConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

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

const CatalogProcessConfig = CommonHTTPServiceConfig.and(ReadModelSQLDbConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(EventStoreConfig)
  .and(FeatureFlagAgreementApprovalPolicyUpdateConfig)
  .and(FeatureFlagAttributeCertifiedDiscreteConfig)
  .and(TenantKindHistoryDBConfig)
  .and(FeatureFlagTenantKindInRiskAnalysisConfig)
  .and(
    z
      .object({
        ESERVICE_DOCUMENTS_PATH: z.string(),
        MAX_FILE_SIZE_BYTES: z.coerce.number().default(10 * 1024 * 1024),
        MAX_INTERFACE_FILE_SIZE_BYTES: z.coerce
          .number()
          .default(3 * 1024 * 1024),
        PRODUCER_ALLOWED_ORIGINS: z.string(),
        GRACE_PERIOD_ARCHIVING_ESERVICE_DAYS: z.coerce
          .number()
          .int()
          .positive(),
      })
      .transform((c) => ({
        eserviceDocumentsPath: c.ESERVICE_DOCUMENTS_PATH,
        maxFileSizeBytes: c.MAX_FILE_SIZE_BYTES,
        maxInterfaceFileSizeBytes: c.MAX_INTERFACE_FILE_SIZE_BYTES,
        producerAllowedOrigins: c.PRODUCER_ALLOWED_ORIGINS.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
        gracePeriodArchivingEServiceDays:
          c.GRACE_PERIOD_ARCHIVING_ESERVICE_DAYS,
      }))
  )
  .and(EServiceTemplateS3Config)
  .and(FeatureFlagAsyncExchangeConfig)
  .and(ApplicationAuditProducerConfig);

type CatalogProcessConfig = z.infer<typeof CatalogProcessConfig>;

export const config: CatalogProcessConfig = CatalogProcessConfig.parse(
  process.env
);
