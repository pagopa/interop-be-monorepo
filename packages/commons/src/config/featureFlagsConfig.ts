import { z } from "zod";

export const FeatureFlagsConfig = z
  .object({
    FEATURE_FLAG_SIGNALHUB_WHITELIST: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .transform((c) => ({
    featureFlagSignalhubWhitelist: c.FEATURE_FLAG_SIGNALHUB_WHITELIST,
  }));

export type FeatureFlagsConfig = z.infer<typeof FeatureFlagsConfig>;
