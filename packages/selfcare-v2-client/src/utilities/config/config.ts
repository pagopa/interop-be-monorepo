import { z } from "zod";

const SelfCareConfig = z
  .object({
    SELFCARE_V2_URL: z.string(),
    SELFCARE_V2_API_KEY: z.string(),
  })
  .transform((c) => ({
    selfcare_baseUrl: c.SELFCARE_V2_URL,
    selfcare_apiKey: c.SELFCARE_V2_API_KEY,
  }));

// type SelfCareConfig = z.infer<typeof SelfCareConfig>;

export const config = SelfCareConfig.parse(process.env);
