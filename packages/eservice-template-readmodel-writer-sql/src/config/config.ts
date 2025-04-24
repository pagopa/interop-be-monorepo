import {
  EServiceTemplateTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

export const ESErviceTemplateReadModelWriterConfig =
  ReadModelWriterConfigSQL.and(EServiceTemplateTopicConfig);

export type ESErviceTemplateReadModelWriterConfig = z.infer<
  typeof ESErviceTemplateReadModelWriterConfig
>;

export const config: ESErviceTemplateReadModelWriterConfig =
  ESErviceTemplateReadModelWriterConfig.parse(process.env);
