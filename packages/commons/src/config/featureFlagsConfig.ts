import { featureFlagNotEnabled } from "pagopa-interop-models";
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

export const FeatureFlagSQLConfig = z
  .object({
    FEATURE_FLAG_SQL: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true")
      .optional(),
  })
  .transform((c) => ({
    featureFlagSQL: c.FEATURE_FLAG_SQL ?? false,
  }));
export type FeatureFlagSQLConfig = z.infer<typeof FeatureFlagSQLConfig>;

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

export const FeatureFlagAdminClientConfig = z
  .object({
    FEATURE_FLAG_ADMIN_CLIENT: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .transform((c) => ({
    featureFlagAdminClient: c.FEATURE_FLAG_ADMIN_CLIENT ?? false,
  }));

export type FeatureFlagAdminClientConfig = z.infer<
  typeof FeatureFlagAdminClientConfig
>;

export const FeatureFlagApplicationAuditConfig = z
  .object({
    FEATURE_FLAG_APPLICATION_AUDIT: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .transform((c) => ({
    featureFlagApplicationAudit: c.FEATURE_FLAG_APPLICATION_AUDIT ?? false,
  }));

export type FeatureFlagApplicationAuditConfig = z.infer<
  typeof FeatureFlagApplicationAuditConfig
>;

type FeatureFlags = FeatureFlagSignalhubWhitelistConfig &
  FeatureFlagAgreementApprovalPolicyUpdateConfig &
  FeatureFlagSQLConfig &
  FeatureFlagAdminClientConfig &
  FeatureFlagApplicationAuditConfig;

export type FeatureFlagKeys = keyof FeatureFlags & `featureFlag${string}`;

/**
 * isFeatureFlagEnabled and assertFeatureFlagEnabled check if a feature flag is enabled in the config.
 * the flags have to start with featureFlag and be exported from the featureFlagsConfig file
 * i.e. assertFeatureFlagEnabled(config, "notExistentFeatureFlag"); will raise a compile error
 */
export const isFeatureFlagEnabled = <K extends string>(
  config: Record<K, unknown>,
  featureFlagName: K & FeatureFlagKeys
): boolean => {
  const featureFlag = config[featureFlagName];

  if (featureFlag === undefined) {
    return false;
  }

  return featureFlag === true;
};
export const assertFeatureFlagEnabled = <K extends string>(
  config: Record<K, unknown>,
  featureFlagName: K & FeatureFlagKeys
): void => {
  if (!isFeatureFlagEnabled(config, featureFlagName)) {
    throw featureFlagNotEnabled(featureFlagName);
  }
};
