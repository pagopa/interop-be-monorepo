import {
  AgreementTopicConfig,
  ReadModelWriterConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const AgreementReadModelWriterConfig =
  ReadModelWriterConfig.and(AgreementTopicConfig);

export type AgreementReadModelWriterConfig = z.infer<
  typeof AgreementReadModelWriterConfig
>;

export const config: AgreementReadModelWriterConfig =
  AgreementReadModelWriterConfig.parse(process.env);
