import { z } from "zod";

export const FeatureFlagsConfig = z
  .object({
    FEATURE_FLAG_SIGNALHUB_WHITELIST: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
    SIGNALHUB_WHITELIST_PRODUCER: z
      .string()
      .transform((value) => value.split(","))
      .pipe(z.array(z.string().uuid()))
      .optional(),
    FEATURE_FLAG_REMOVE_CLIENT_ADMIN: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .transform((c) => ({
    featureFlagSignalhubWhitelist: c.FEATURE_FLAG_SIGNALHUB_WHITELIST,
    signalhubWhitelistProducer: c.SIGNALHUB_WHITELIST_PRODUCER,
    featureFlagRemoveClientAdmin: c.FEATURE_FLAG_REMOVE_CLIENT_ADMIN,
  }));

export type FeatureFlagsConfig = z.infer<typeof FeatureFlagsConfig>;
