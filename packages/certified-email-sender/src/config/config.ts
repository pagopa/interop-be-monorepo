import {
  AgreementTopicConfig,
  PecEmailManagerConfig,
  KafkaConsumerConfig,
  ReadModelDbConfig,
  ReadModelSQLDbConfig,
  FeatureFlagSQLConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

export const PECEmailSenderConfig = z
  .object({
    PEC_SENDER_MAIL: z.string().email(),
    PEC_SENDER_LABEL: z.string(),
  })
  .transform((c) => ({
    pecSenderMail: c.PEC_SENDER_MAIL,
    pecSenderLabel: c.PEC_SENDER_LABEL,
  }));
export type PECEmailSenderConfig = z.infer<typeof PECEmailSenderConfig>;

export const CertifiedEmailSenderConfig = KafkaConsumerConfig.and(
  ReadModelDbConfig
)
  .and(AgreementTopicConfig)
  .and(PecEmailManagerConfig)
  .and(PECEmailSenderConfig)
  .and(FeatureFlagSQLConfig)
  .and(ReadModelSQLDbConfig.optional());

export type CertifiedEmailSenderConfig = z.infer<
  typeof CertifiedEmailSenderConfig
>;

export const config: CertifiedEmailSenderConfig =
  CertifiedEmailSenderConfig.parse(process.env);
