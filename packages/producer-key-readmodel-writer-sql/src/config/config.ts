import {
  AuthorizationTopicConfig,
  ReadModelWriterConfigSQL,
} from "pagopa-interop-commons";
import { z } from "zod";

const ProducerKeyReadModelWriterConfig = ReadModelWriterConfigSQL.and(
  AuthorizationTopicConfig
);

type ProducerKeyReadModelWriterConfig = z.infer<
  typeof ProducerKeyReadModelWriterConfig
>;

export const config: ProducerKeyReadModelWriterConfig =
  ProducerKeyReadModelWriterConfig.parse(process.env);
