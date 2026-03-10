import {
  DelegationTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

const DelegationReadModelWriterConfig = ReadModelWriterConfigSQL.and(
  DelegationTopicConfig
);

type DelegationReadModelWriterConfig = z.infer<
  typeof DelegationReadModelWriterConfig
>;

export const config: DelegationReadModelWriterConfig =
  DelegationReadModelWriterConfig.parse(process.env);
