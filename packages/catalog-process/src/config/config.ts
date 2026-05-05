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
        PRODUCER_ALLOWED_ORIGINS: z.string(),
      })
      .transform((c) => ({
        eserviceDocumentsPath: c.ESERVICE_DOCUMENTS_PATH,
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
