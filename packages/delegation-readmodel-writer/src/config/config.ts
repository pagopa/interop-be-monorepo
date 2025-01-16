import {
  DelegationTopicConfig,
  ReadModelWriterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const DelegationReadModelWriterConfig = ReadModelWriterConfig.and(
  DelegationTopicConfig
);

export type DelegationReadModelWriterConfig = z.infer<
  typeof DelegationReadModelWriterConfig
>;

export const config: DelegationReadModelWriterConfig =
  DelegationReadModelWriterConfig.parse(process.env);
