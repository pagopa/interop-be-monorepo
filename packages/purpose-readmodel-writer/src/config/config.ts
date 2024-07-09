import {
  PurposeTopicConfig,
  ReadModelWriterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const PurposeReadModelWriterConfig =
  ReadModelWriterConfig.and(PurposeTopicConfig);

export type PurposeReadModelWriterConfig = z.infer<
  typeof PurposeReadModelWriterConfig
>;

export const config: PurposeReadModelWriterConfig =
  PurposeReadModelWriterConfig.parse(process.env);
