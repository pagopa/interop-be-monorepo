import { z } from "zod";

export const SelfCareClientConfig = z
  .object({
    SELFCARE_V2_URL: z.string(),
    SELFCARE_V2_API_KEY: z.string(),
  })
  .transform((c) => ({
    selfcareBaseUrl: c.SELFCARE_V2_URL,
    selfcareApiKey: c.SELFCARE_V2_API_KEY,
  }));

export type SelfCareClientConfig = z.infer<typeof SelfCareClientConfig>;

export const SelfcareConsumerConfig = z
  .object({
    SELFCARE_TOPIC: z.string(),
    INTEROP_PRODUCT: z.string(),
  })
  .transform((c) => ({
    selfcareTopic: c.SELFCARE_TOPIC,
    interopProduct: c.INTEROP_PRODUCT,
  }));

export type SelfcareConsumerConfig = z.infer<typeof SelfcareConsumerConfig>;
