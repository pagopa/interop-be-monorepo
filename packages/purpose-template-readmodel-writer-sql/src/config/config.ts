import {
  PurposeTemplateTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeTemplateReadModelWriterConfig = ReadModelWriterConfigSQL.and(
  PurposeTemplateTopicConfig
);
type PurposeTemplateReadModelWriterConfig = z.infer<
  typeof PurposeTemplateReadModelWriterConfig
>;

export const config: PurposeTemplateReadModelWriterConfig =
  PurposeTemplateReadModelWriterConfig.parse(process.env);
