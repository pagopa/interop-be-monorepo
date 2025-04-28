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

export const featureFlagAdminClientConfig = z
  .object({
    FEATURE_FLAG_ADMIN_CLIENT: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .transform((c) => ({
    featureFlagAdminClient: c.FEATURE_FLAG_ADMIN_CLIENT ?? false,
  }));

export type featureFlagAdminClientConfig = z.infer<
  typeof featureFlagAdminClientConfig
>;

type FeatureFlags = FeatureFlagSignalhubWhitelistConfig &
  FeatureFlagAgreementApprovalPolicyUpdateConfig &
  featureFlagAdminClientConfig;

export type FeatureFlagKeys = keyof Pick<
  FeatureFlags,
  {
    [K in keyof (FeatureFlagSignalhubWhitelistConfig &
      FeatureFlagAgreementApprovalPolicyUpdateConfig &
      featureFlagAdminClientConfig)]: K extends `featureFlag${string}`
      ? K
      : never;
  }[keyof (FeatureFlagSignalhubWhitelistConfig &
    FeatureFlagAgreementApprovalPolicyUpdateConfig &
    featureFlagAdminClientConfig)]
>;

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
