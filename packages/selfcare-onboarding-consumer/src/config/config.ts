import { z } from "zod";
import {
  KafkaConsumerConfig,
  TokenGenerationConfig,
} from "pagopa-interop-commons";

export const SelfcareOnboardingConsumerConfig = KafkaConsumerConfig.and(
  TokenGenerationConfig
).and(
  z
    .object({
      SELFCARE_TOPIC: z.string(),

      INTEROP_PRODUCT: z.string(),
      ALLOWED_ORIGINS: z.string(),

      TENANT_PROCESS_URL: z.string(),
    })
    .transform((c) => ({
      selfcareTopic: c.SELFCARE_TOPIC,
      interopProduct: c.INTEROP_PRODUCT,
      allowedOrigins: c.ALLOWED_ORIGINS.split(","),
      tenantProcessUrl: c.TENANT_PROCESS_URL,
    }))
);

export type SelfcareOnboardingConsumerConfig = z.infer<
  typeof SelfcareOnboardingConsumerConfig
>;

export const config: SelfcareOnboardingConsumerConfig =
  SelfcareOnboardingConsumerConfig.parse(process.env);
