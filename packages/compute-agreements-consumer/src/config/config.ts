import {
  KafkaConsumerConfig,
  TenantTopicConfig,
  TokenGenerationConfig,
  FeatureFlagAttributeCertifiedDiscreteConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const ComputeAgreementsConsumerConfig = KafkaConsumerConfig.and(
  TokenGenerationConfig
)
  .and(TenantTopicConfig)
  .and(FeatureFlagAttributeCertifiedDiscreteConfig)
  .and(
    z
      .object({
        AGREEMENT_PROCESS_URL: z.string(),
      })
      .transform((c) => ({
        agreementProcessUrl: c.AGREEMENT_PROCESS_URL,
      }))
  );

type ComputeAgreementsConsumerConfig = z.infer<
  typeof ComputeAgreementsConsumerConfig
>;

export const config: ComputeAgreementsConsumerConfig =
  ComputeAgreementsConsumerConfig.parse(process.env);
