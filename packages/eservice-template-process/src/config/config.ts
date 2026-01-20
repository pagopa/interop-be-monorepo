import {
  CommonHTTPServiceConfig,
  FileManagerConfig,
  EventStoreConfig,
  S3Config,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
  FeatureFlagEServicePersonalDataConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const EServiceTemplateProcessConfig = CommonHTTPServiceConfig.and(
  ReadModelSQLDbConfig
)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(EventStoreConfig)
  .and(
    z
      .object({
        PRODUCER_ALLOWED_ORIGINS: z.string(),
        ESERVICE_TEMPLATE_DOCUMENTS_PATH: z.string(),
      })
      .transform((c) => ({
        producerAllowedOrigins: c.PRODUCER_ALLOWED_ORIGINS.split(",")
          .map((origin) => origin.trim())
          .filter(Boolean),
        eserviceTemplateDocumentsPath: c.ESERVICE_TEMPLATE_DOCUMENTS_PATH,
      }))
  )
  .and(ApplicationAuditProducerConfig)
  .and(FeatureFlagEServicePersonalDataConfig);

type EServiceTemplateProcessConfig = z.infer<
  typeof EServiceTemplateProcessConfig
>;

export const config: EServiceTemplateProcessConfig =
  EServiceTemplateProcessConfig.parse(process.env);
