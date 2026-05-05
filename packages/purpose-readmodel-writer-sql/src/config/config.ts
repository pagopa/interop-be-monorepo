import {
  PurposeTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

const PurposeReadModelWriterConfig =
  ReadModelWriterConfigSQL.and(PurposeTopicConfig);

type PurposeReadModelWriterConfig = z.infer<
  typeof PurposeReadModelWriterConfig
>;

export const config: PurposeReadModelWriterConfig =
  PurposeReadModelWriterConfig.parse(process.env);
