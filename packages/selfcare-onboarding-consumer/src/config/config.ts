import {
  KafkaConsumerConfig,
  SelfcareConsumerConfig,
  TenantProcessServerConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const SelfcareOnboardingConsumerConfig = KafkaConsumerConfig.and(
  TokenGenerationConfig
)
  .and(SelfcareConsumerConfig)
  .and(TenantProcessServerConfig)
  .and(
    z
      .object({
        ALLOWED_ORIGINS: z.string(),
      })
      .transform((c) => ({
        allowedOrigins: c.ALLOWED_ORIGINS.split(","),
      }))
  );

type SelfcareOnboardingConsumerConfig = z.infer<
  typeof SelfcareOnboardingConsumerConfig
>;

export const config: SelfcareOnboardingConsumerConfig =
  SelfcareOnboardingConsumerConfig.parse(process.env);
