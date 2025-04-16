import { z } from "zod";
import {
  AuthorizationServerTokenGenerationConfig,
  KafkaConsumerConfig,
} from "pagopa-interop-commons";

export const SelfcareClientUsersUpdaterConsumerConfig = KafkaConsumerConfig.and(
  AuthorizationServerTokenGenerationConfig
).and(
  z
    .object({
      SELFCARE_TOPIC: z.string(),
      INTEROP_PRODUCT_IDENTIFIER: z.string(),
      ALLOWED_ORIGINS: z.string(),
      ALLOWE_ORIGINS_UUID: z.string().uuid(),
      AUTHORIZATION_PROCESS_URL: z.string(),
    })
    .transform((c) => ({
      selfcareTopic: c.SELFCARE_TOPIC,
      interopProductId: c.INTEROP_PRODUCT_IDENTIFIER,
      allowedOrigins: c.ALLOWED_ORIGINS.split(","),
      allowedOriginsUuid: c.ALLOWED_ORIGINS.split(","),
      authorizationProcessUrl: c.AUTHORIZATION_PROCESS_URL,
    }))
);

export type SelfcareClientUsersUpdaterConsumerConfig = z.infer<
  typeof SelfcareClientUsersUpdaterConsumerConfig
>;

export const config: SelfcareClientUsersUpdaterConsumerConfig =
  SelfcareClientUsersUpdaterConsumerConfig.parse(process.env);
