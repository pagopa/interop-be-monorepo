import {
  APIEndpoint,
  KafkaConsumerConfig,
  EServiceTemplateTopicConfig,
  TokenGenerationConfig,
  FileManagerConfig,
  LoggerConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

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

const EServiceTemplateUpdaterConfig = CatalogProcessServerConfig.and(
  EServiceTemplateTopicConfig
)
  .and(FileManagerConfig)
  .and(LoggerConfig)
  .and(TokenGenerationConfig)
  .and(KafkaConsumerConfig)
  .and(ReadModelSQLDbConfig);

type EServiceTemplateUpdaterConfig = z.infer<
  typeof EServiceTemplateUpdaterConfig
>;
export const config: EServiceTemplateUpdaterConfig =
  EServiceTemplateUpdaterConfig.parse(process.env);
