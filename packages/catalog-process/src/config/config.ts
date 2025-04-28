import {
  CommonHTTPServiceConfig,
  ReadModelDbConfig,
  FileManagerConfig,
  EventStoreConfig,
  S3Config,
  FeatureFlagsConfig,
  ApplicationAuditProducerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const EServiceTemplateS3Config = z
  .object({
    ESERVICE_TEMPLATE_DOCUMENTS_CONTAINER: z.string(),
    ESERVICE_TEMPLATE_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    eserviceTemplateDocumentsContainer: c.ESERVICE_TEMPLATE_DOCUMENTS_CONTAINER,
    eserviceTemplateDocumentsPath: c.ESERVICE_TEMPLATE_DOCUMENTS_PATH,
  }));
export type EServiceTemplateS3Config = z.infer<typeof EServiceTemplateS3Config>;

const CatalogProcessConfig = CommonHTTPServiceConfig.and(ReadModelDbConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(EventStoreConfig)
  .and(FeatureFlagsConfig)
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

export type CatalogProcessConfig = z.infer<typeof CatalogProcessConfig>;

export const config: CatalogProcessConfig = CatalogProcessConfig.parse(
  process.env
);
