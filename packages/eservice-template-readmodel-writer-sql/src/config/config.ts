import {
  EServiceTemplateTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

const ESErviceTemplateReadModelWriterConfig = ReadModelWriterConfigSQL.and(
  EServiceTemplateTopicConfig
);

type ESErviceTemplateReadModelWriterConfig = z.infer<
  typeof ESErviceTemplateReadModelWriterConfig
>;

export const config: ESErviceTemplateReadModelWriterConfig =
  ESErviceTemplateReadModelWriterConfig.parse(process.env);
