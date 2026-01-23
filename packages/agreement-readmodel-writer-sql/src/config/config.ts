import { AgreementTopicConfig } from "pagopa-interop-commons";
import { z } from "zod";
import { ReadModelWriterConfigSQL } from "pagopa-interop-commons";

const AgreementReadModelWriterConfig =
  ReadModelWriterConfigSQL.and(AgreementTopicConfig);

type AgreementReadModelWriterConfig = z.infer<
  typeof AgreementReadModelWriterConfig
>;

export const config: AgreementReadModelWriterConfig =
  AgreementReadModelWriterConfig.parse(process.env);
