import {
  AgreementTopicConfig,
  PecEmailManagerConfig,
  KafkaConsumerConfig,
  ReadModelSQLDbConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const PECEmailSenderConfig = z
  .object({
    PEC_SENDER_MAIL: z.string().email(),
    PEC_SENDER_LABEL: z.string(),
  })
  .transform((c) => ({
    pecSenderMail: c.PEC_SENDER_MAIL,
    pecSenderLabel: c.PEC_SENDER_LABEL,
  }));
type PECEmailSenderConfig = z.infer<typeof PECEmailSenderConfig>;

const CertifiedEmailSenderConfig = KafkaConsumerConfig.and(ReadModelSQLDbConfig)
  .and(AgreementTopicConfig)
  .and(PecEmailManagerConfig)
  .and(PECEmailSenderConfig);

type CertifiedEmailSenderConfig = z.infer<typeof CertifiedEmailSenderConfig>;

export const config: CertifiedEmailSenderConfig =
  CertifiedEmailSenderConfig.parse(process.env);
