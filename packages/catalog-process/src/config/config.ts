import {
  CommonHTTPServiceConfig,
  FileManagerConfig,
  EventStoreConfig,
  S3Config,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
  FeatureFlagAgreementApprovalPolicyUpdateConfig,
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
  .and(
    z
      .object({
        ESERVICE_DOCUMENTS_PATH: z.string(),
        MAX_FILE_SIZE_BYTES: z.coerce.number().default(10 * 1024 * 1024),
        MAX_INTERFACE_FILE_SIZE_BYTES: z.coerce
          .number()
          .default(3 * 1024 * 1024),
        PRODUCER_ALLOWED_ORIGINS: z.string(),
      })
      .transform((c) => ({
        eserviceDocumentsPath: c.ESERVICE_DOCUMENTS_PATH,
        maxFileSizeBytes: c.MAX_FILE_SIZE_BYTES,
        maxInterfaceFileSizeBytes: c.MAX_INTERFACE_FILE_SIZE_BYTES,
        producerAllowedOrigins: c.PRODUCER_ALLOWED_ORIGINS.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
      }))
  )
  .and(EServiceTemplateS3Config)
  .and(ApplicationAuditProducerConfig);

type CatalogProcessConfig = z.infer<typeof CatalogProcessConfig>;

export const config: CatalogProcessConfig = CatalogProcessConfig.parse(
  process.env
);
