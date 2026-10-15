import {
  KafkaConsumerConfig,
  TenantTopicConfig,
  TokenGenerationConfig,
  FeatureFlagAttributeCertifiedDiscreteConfig,
  AgreementProcessServerConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const ComputeAgreementsConsumerConfig = KafkaConsumerConfig.and(
  TokenGenerationConfig
)
  .and(TenantTopicConfig)
  .and(FeatureFlagAttributeCertifiedDiscreteConfig)
  .and(AgreementProcessServerConfig);

type ComputeAgreementsConsumerConfig = z.infer<
  typeof ComputeAgreementsConsumerConfig
>;

export const config: ComputeAgreementsConsumerConfig =
  ComputeAgreementsConsumerConfig.parse(process.env);
