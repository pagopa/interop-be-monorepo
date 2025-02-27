import {
  APIEndpoint,
  KafkaConsumerConfig,
  EServiceTemplateTopicConfig,
  TokenGenerationConfig,
  FileManagerConfig,
  LoggerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

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

export const EServiceTemplateProcessServerConfig = z
  .object({
    ESERVICE_TEMPLATE_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    eserviceTemplateUrl: c.ESERVICE_TEMPLATE_PROCESS_URL,
  }));

export type EServiceTemplateProcessServerConfig = z.infer<
  typeof EServiceTemplateProcessServerConfig
>;

const EServiceTemplateUpdaterConfig = CatalogProcessServerConfig.and(
  EServiceTemplateTopicConfig
)
  .and(FileManagerConfig)
  .and(LoggerConfig)
  .and(TokenGenerationConfig)
  .and(KafkaConsumerConfig);

export type EServiceTemplateUpdaterConfig = z.infer<
  typeof EServiceTemplateUpdaterConfig
>;
export const config: EServiceTemplateUpdaterConfig =
  EServiceTemplateUpdaterConfig.parse(process.env);
