import { notFound } from "pagopa-interop-models";
import { z } from "zod";

export const FeatureFlagSignalhubConfig = z
  .object({
    FEATURE_FLAG_SIGNALHUB_WHITELIST: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true")
      .optional(),
    SIGNALHUB_WHITELIST_PRODUCER: z
      .string()
      .transform((value) => value.split(","))
      .pipe(z.array(z.string().uuid()))
      .optional(),
  })
  .transform((c) => ({
    featureFlagSignalhubWhitelist: c.FEATURE_FLAG_SIGNALHUB_WHITELIST ?? false,
    signalhubWhitelistProducer: c.SIGNALHUB_WHITELIST_PRODUCER,
  }));

export type FeatureFlagSignalhubConfig = z.infer<
  typeof FeatureFlagSignalhubConfig
>;

export const FeatureFlagAgreementApprovalPolicyUpdateConfig = z
  .object({
    FEATURE_FLAG_AGREEMENT_APPROVAL_POLICY_UPDATE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true")
      .optional(),
  })
  .transform((c) => ({
    featureFlagAgreementApprovalPolicyUpdate:
      c.FEATURE_FLAG_AGREEMENT_APPROVAL_POLICY_UPDATE ?? false,
  }));

export type FeatureFlagAgreementApprovalPolicyUpdateConfig = z.infer<
  typeof FeatureFlagAgreementApprovalPolicyUpdateConfig
>;

export const assertFeatureFlag = <
  T extends Record<string, unknown>,
  K extends keyof T & string
>(
  config: T,
  featureFlagName: K extends `featureFlag${string}` ? K : never
): void => {
  const featureFlag = config[featureFlagName];

  if (featureFlag === undefined) {
    throw notFound(); // Flag doesn't exist in the config
  }

  if (featureFlag !== true) {
    throw notFound(); // Flag exists but isn't enabled
  }
};
