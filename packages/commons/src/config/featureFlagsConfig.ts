import { featureFlagNotEnabled } from "pagopa-interop-models";
import { z } from "zod";

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

export const FeatureFlagPurposeTemplateConfig = z
  .object({
    FEATURE_FLAG_PURPOSE_TEMPLATE: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true")
      .optional(),
  })
  .transform((c) => ({
    featureFlagPurposeTemplate: c.FEATURE_FLAG_PURPOSE_TEMPLATE ?? false,
  }));
export type FeatureFlagPurposeTemplateConfig = z.infer<
  typeof FeatureFlagPurposeTemplateConfig
>;

export const FeatureFlagEServicePersonalDataConfig = z
  .object({
    FEATURE_FLAG_ESERVICE_PERSONAL_DATA: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true")
      .optional(),
  })
  .transform((c) => ({
    featureFlagEservicePersonalData:
      c.FEATURE_FLAG_ESERVICE_PERSONAL_DATA ?? false,
  }));
export type FeatureFlagEServicePersonalDataConfig = z.infer<
  typeof FeatureFlagEServicePersonalDataConfig
>;

export const FeatureFlagDelegationsProcessContractBuilderConfig = z
  .object({
    FEATURE_FLAG_DELEGATIONS_CONTRACT_BUILDER: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true")
      .optional(),
  })
  .transform((c) => ({
    featureFlagDelegationsContractBuilder:
      c.FEATURE_FLAG_DELEGATIONS_CONTRACT_BUILDER ?? false,
  }));
export type FeatureFlagDelegationsProcessContractBuilderConfig = z.infer<
  typeof FeatureFlagDelegationsProcessContractBuilderConfig
>;

export const FeatureFlagAgreementsProcessContractBuilderConfig = z
  .object({
    FEATURE_FLAG_AGREEMENTS_CONTRACT_BUILDER: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true")
      .optional(),
  })
  .transform((c) => ({
    featureFlagAgreementsContractBuilder:
      c.FEATURE_FLAG_AGREEMENTS_CONTRACT_BUILDER ?? false,
  }));
export type FeatureFlagAgreementsProcessContractBuilderConfig = z.infer<
  typeof FeatureFlagAgreementsProcessContractBuilderConfig
>;

export const FeatureFlagPurposesProcessContractBuilderConfig = z
  .object({
    FEATURE_FLAG_PURPOSES_CONTRACT_BUILDER: z
      .enum(["true", "false"])
      .default("true")
      .transform((value) => value === "true")
      .optional(),
  })
  .transform((c) => ({
    featureFlagPurposesContractBuilder:
      c.FEATURE_FLAG_PURPOSES_CONTRACT_BUILDER ?? false,
  }));
export type FeatureFlagPurposesProcessContractBuilderConfig = z.infer<
  typeof FeatureFlagPurposesProcessContractBuilderConfig
>;

export const FeatureFlagUseSignedDocumentConfig = z
  .object({
    FEATURE_FLAG_USE_SIGNED_DOCUMENT: z
      .enum(["true", "false"])
      .default("false")
      .transform((value) => value === "true")
      .optional(),
  })
  .transform((c) => ({
    featureFlagUseSignedDocument: c.FEATURE_FLAG_USE_SIGNED_DOCUMENT ?? false,
  }));
export type FeatureFlagUseSignedDocumentConfig = z.infer<
  typeof FeatureFlagUseSignedDocumentConfig
>;

type FeatureFlags = FeatureFlagAgreementApprovalPolicyUpdateConfig &
  FeatureFlagApplicationAuditStrictConfig &
  FeatureFlagImprovedProducerVerificationClaimsConfig &
  FeatureFlagClientAssertionStrictClaimsValidationConfig &
  FeatureFlagNotificationConfig &
  FeatureFlagPurposeTemplateConfig &
  FeatureFlagEServicePersonalDataConfig &
  FeatureFlagDelegationsProcessContractBuilderConfig &
  FeatureFlagAgreementsProcessContractBuilderConfig &
  FeatureFlagPurposesProcessContractBuilderConfig &
  FeatureFlagUseSignedDocumentConfig;

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
