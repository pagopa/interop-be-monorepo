import {
  KafkaConsumerConfig,
  SelfcareConsumerConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";
import { z } from "zod";

const SelfcareOnboardingConsumerConfig = KafkaConsumerConfig.and(
  TokenGenerationConfig
)
  .and(SelfcareConsumerConfig)
  .and(
    z
      .object({
        ALLOWED_ORIGINS: z.string(),
        TENANT_PROCESS_URL: z.string(),
      })
      .transform((c) => ({
        tenantProcessUrl: c.TENANT_PROCESS_URL,
        allowedOrigins: c.ALLOWED_ORIGINS.split(","),
      }))
  );

type SelfcareOnboardingConsumerConfig = z.infer<
  typeof SelfcareOnboardingConsumerConfig
>;

export const config: SelfcareOnboardingConsumerConfig =
  SelfcareOnboardingConsumerConfig.parse(process.env);
