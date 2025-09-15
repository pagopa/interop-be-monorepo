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

export const FeatureFlagApplicationAuditStrictConfig = z
  .object({
    FEATURE_FLAG_APPLICATION_AUDIT_STRICT_STRICT: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .transform((c) => ({
    featureFlagApplicationAuditStrict:
      c.FEATURE_FLAG_APPLICATION_AUDIT_STRICT_STRICT ?? false,
  }));

export type FeatureFlagApplicationAuditStrictConfig = z.infer<
  typeof FeatureFlagApplicationAuditStrictConfig
>;

export const FeatureFlagImprovedProducerVerificationClaimsConfig = z
  .object({
    FEATURE_FLAG_IMPROVED_PRODUCER_VERIFICATION_CLAIMS: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .transform((c) => ({
    featureFlagImprovedProducerVerificationClaims:
      c.FEATURE_FLAG_IMPROVED_PRODUCER_VERIFICATION_CLAIMS ?? false,
  }));
export type FeatureFlagImprovedProducerVerificationClaimsConfig = z.infer<
  typeof FeatureFlagImprovedProducerVerificationClaimsConfig
>;

export const FeatureFlagClientAssertionStrictClaimsValidationConfig = z
  .object({
    FEATURE_FLAG_CLIENT_ASSERTION_STRICT_CLAIMS_VALIDATION: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true"),
  })
  .transform((c) => ({
    featureFlagClientAssertionStrictClaimsValidation:
      c.FEATURE_FLAG_CLIENT_ASSERTION_STRICT_CLAIMS_VALIDATION ?? false,
  }));
export type FeatureFlagClientAssertionStrictClaimsValidationConfig = z.infer<
  typeof FeatureFlagClientAssertionStrictClaimsValidationConfig
>;

export const FeatureFlagNotificationConfig = z
  .object({
    FEATURE_FLAG_NOTIFICATION_CONFIG: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true")
      .optional(),
  })
  .transform((c) => ({
    featureFlagNotificationConfig: c.FEATURE_FLAG_NOTIFICATION_CONFIG ?? false,
  }));
export type FeatureFlagNotificationConfig = z.infer<
  typeof FeatureFlagNotificationConfig
>;

type FeatureFlags = FeatureFlagSignalhubWhitelistConfig &
  FeatureFlagAgreementApprovalPolicyUpdateConfig &
  FeatureFlagApplicationAuditStrictConfig &
  FeatureFlagImprovedProducerVerificationClaimsConfig &
  FeatureFlagClientAssertionStrictClaimsValidationConfig &
  FeatureFlagNotificationConfig;

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
