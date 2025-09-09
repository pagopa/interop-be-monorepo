import {
  PurposeTemplateTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

export const PurposeTemplateReadModelWriterConfig =
  ReadModelWriterConfigSQL.and(PurposeTemplateTopicConfig);
export type PurposeTemplateReadModelWriterConfig = z.infer<
  typeof PurposeTemplateReadModelWriterConfig
>;

export const config: PurposeTemplateReadModelWriterConfig =
  PurposeTemplateReadModelWriterConfig.parse(process.env);
