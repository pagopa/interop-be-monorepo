import { notFound } from "pagopa-interop-models";
import { z } from "zod";

export const FeatureFlagSignalhubWhitelistConfig = z
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

export type FeatureFlagSignalhubWhitelistConfig = z.infer<
  typeof FeatureFlagSignalhubWhitelistConfig
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

type FeatureFlags = FeatureFlagSignalhubWhitelistConfig &
  FeatureFlagAgreementApprovalPolicyUpdateConfig;

export type FeatureFlagKeys = keyof Pick<
  FeatureFlags,
  {
    [K in keyof (FeatureFlagSignalhubWhitelistConfig &
      FeatureFlagAgreementApprovalPolicyUpdateConfig)]: K extends `featureFlag${string}`
      ? K
      : never;
  }[keyof (FeatureFlagSignalhubWhitelistConfig &
    FeatureFlagAgreementApprovalPolicyUpdateConfig)]
>;

/**
 * isFeatureFlagEnabled and assertFeatureFlagEnabled check if a feature flag is enabled in the config.
 * the flags have to start with featureFlag and be exported from the featureFlagsConfig file
 * i.e. assertFeatureFlagEnabled(config, "notExistentFeatureFlag"); will raise a compile error
 */
export const isFeatureFlagEnabled = <
  T extends Record<string, unknown>,
  K extends keyof T & string
>(
  config: T,
  featureFlagName: K extends FeatureFlagKeys ? K : never
): boolean => {
  const featureFlag = config[featureFlagName];

  if (featureFlag === undefined) {
    return false;
  }

  return featureFlag === true;
};
export const assertFeatureFlagEnabled = <
  T extends Record<string, unknown>,
  K extends keyof T & string
>(
  config: T,
  featureFlagName: K extends FeatureFlagKeys ? K : never
): void => {
  if (!isFeatureFlagEnabled(config, featureFlagName)) {
    throw notFound();
  }
};
