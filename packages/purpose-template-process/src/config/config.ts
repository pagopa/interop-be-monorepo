import {
  CommonHTTPServiceConfig,
  EventStoreConfig,
  ApplicationAuditProducerConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeTemplateProcessConfig = CommonHTTPServiceConfig
  .and(EventStoreConfig)
  .and(ApplicationAuditProducerConfig)
  .and(ReadModelSQLDbConfig);

export type PurposeTemplateProcessConfig = z.infer<typeof PurposeTemplateProcessConfig>;

export const config: PurposeTemplateProcessConfig = PurposeTemplateProcessConfig.parse(
  process.env
);
