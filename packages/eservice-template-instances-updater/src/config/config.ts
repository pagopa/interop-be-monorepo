import {
  CatalogProcessServerConfig,
  KafkaConsumerConfig,
  EServiceTemplateTopicConfig,
  TokenGenerationConfig,
  FileManagerConfig,
  LoggerConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const EServiceDocumentsConfig = z
  .object({
    ESERVICE_DOCUMENTS_CONTAINER: z.string(),
    ESERVICE_DOCUMENTS_PATH: z.string(),
  })
  .transform((c) => ({
    eserviceDocumentsContainer: c.ESERVICE_DOCUMENTS_CONTAINER,
    eserviceDocumentsPath: c.ESERVICE_DOCUMENTS_PATH,
  }));

const EServiceTemplateUpdaterConfig = CatalogProcessServerConfig.and(
  EServiceDocumentsConfig
)
  .and(EServiceTemplateTopicConfig)
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
