import {
  CommonHTTPServiceConfig,
  EventStoreConfig,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
  S3Config,
  FileManagerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeTemplateProcessConfig = CommonHTTPServiceConfig.and(
  EventStoreConfig
)
  .and(ApplicationAuditProducerConfig)
  .and(ReadModelSQLDbConfig)
  .and(FileManagerConfig)
  .and(S3Config)
  .and(
    z
      .object({
        PURPOSE_TEMPLATE_DOCUMENTS_PATH: z.string(),
        PURPOSE_TEMPLATE_ANNOTATIONS_PATH: z.string(),
      })
      .transform((c) => ({
        purposeTemplateDocumentsPath: c.PURPOSE_TEMPLATE_DOCUMENTS_PATH,
        purposeTemplateAnnotationsPath: c.PURPOSE_TEMPLATE_ANNOTATIONS_PATH,
      }))
  );

export type PurposeTemplateProcessConfig = z.infer<
  typeof PurposeTemplateProcessConfig
>;

export const config: PurposeTemplateProcessConfig =
  PurposeTemplateProcessConfig.parse(process.env);
