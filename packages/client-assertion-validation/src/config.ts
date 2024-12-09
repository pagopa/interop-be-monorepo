import { z } from "zod";

export const ClientAssertionValidationConfig = z
  .object({
    CLIENT_ASSERTION_AUDIENCE: z.string(),
  })
  .transform((c) => ({
    clientAssertionAudience: c.CLIENT_ASSERTION_AUDIENCE.split(",").map(
      (audienceEntry) => audienceEntry.trim()
    ),
  }));

export type ClientAssertionValidationConfig = z.infer<
  typeof ClientAssertionValidationConfig
>;
