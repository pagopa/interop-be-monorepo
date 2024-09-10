import { z } from "zod";
import { TokenGenerationConfig } from "pagopa-interop-commons";

export const SelfcareOnboardingConsumerConfig = TokenGenerationConfig.and(
  z
    .object({
      SELFCARE_BROKER_URLS: z.string(),
      BROKER_CONNECTION_STRING: z.string(),
      KAFKA_CLIENT_ID: z.string(),
      KAFKA_GROUP_ID: z.string(),
      TOPIC_NAME: z.string(),

      RESET_CONSUMER_OFFSETS: z.string().default("false"),

      INTEROP_PRODUCT: z.string(),
      ALLOWED_ORIGINS: z.string(),

      TENANT_PROCESS_URL: z.string(),
    })
    .transform((c) => ({
      selfcareBrokerUrls: c.SELFCARE_BROKER_URLS.split(","),
      brokerConnectionString: c.BROKER_CONNECTION_STRING,
      kafkaClientId: c.KAFKA_CLIENT_ID,
      kafkaGroupId: c.KAFKA_GROUP_ID,
      topicName: c.TOPIC_NAME,
      resetConsumerOffsets: c.RESET_CONSUMER_OFFSETS.toLowerCase() === "true",
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
