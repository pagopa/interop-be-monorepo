import { z } from "zod";

import { genericLogger } from "../logging/index.js";
import { APIEndpoint } from "../model/apiEndpoint.js";

type ProcessServerUrl = z.infer<typeof APIEndpoint>;

/**
 * Resolves a config value that may still be provided under a deprecated env
 * variable name. Prefers the canonical key; if it is missing but the deprecated
 * key is set and valid, it falls back to it and logs a warning so the deployment
 * can be updated. The deprecated value is ignored when the canonical one is set.
 * If neither is set, it registers a validation issue so the parse fails as it
 * would for any other required variable.
 */
const resolveDeprecatedAPIEndpointFallback = (
  ctx: z.RefinementCtx,
  canonical: { key: string; value: ProcessServerUrl | undefined },
  deprecated: { key: string; value: unknown }
): ProcessServerUrl => {
  if (canonical.value !== undefined) {
    return canonical.value;
  }
  if (deprecated.value !== undefined) {
    const parsedDeprecatedValue: ReturnType<typeof APIEndpoint.safeParse> =
      APIEndpoint.safeParse(deprecated.value);
    if (!parsedDeprecatedValue.success) {
      for (const issue of parsedDeprecatedValue.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: issue.message,
          path: [deprecated.key, ...issue.path],
        });
      }
      return z.NEVER;
    }
    genericLogger.warn(
      `Configuration is falling back to the deprecated env variable "${deprecated.key}" because "${canonical.key}" is not set. Please update the configuration to use "${canonical.key}".`
    );
    return parsedDeprecatedValue.data;
  }
  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    message: `Missing required env variable "${canonical.key}"`,
  });
  return z.NEVER;
};

export const TenantProcessServerConfig = z
  .object({
    TENANT_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    tenantProcessUrl: c.TENANT_PROCESS_URL,
  }));
export type TenantProcessServerConfig = z.infer<
  typeof TenantProcessServerConfig
>;

export const CatalogProcessServerConfig = z
  .object({
    CATALOG_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    catalogProcessUrl: c.CATALOG_PROCESS_URL,
  }));
export type CatalogProcessServerConfig = z.infer<
  typeof CatalogProcessServerConfig
>;

export const AgreementProcessServerConfig = z
  .object({
    AGREEMENT_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    agreementProcessUrl: c.AGREEMENT_PROCESS_URL,
  }));
export type AgreementProcessServerConfig = z.infer<
  typeof AgreementProcessServerConfig
>;

export const PurposeProcessServerConfig = z
  .object({
    PURPOSE_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    purposeProcessUrl: c.PURPOSE_PROCESS_URL,
  }));
export type PurposeProcessServerConfig = z.infer<
  typeof PurposeProcessServerConfig
>;

export const PurposeTemplateProcessServerConfig = z
  .object({
    PURPOSE_TEMPLATE_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    purposeTemplateProcessUrl: c.PURPOSE_TEMPLATE_PROCESS_URL,
  }));
export type PurposeTemplateProcessServerConfig = z.infer<
  typeof PurposeTemplateProcessServerConfig
>;

/**
 * `ATTRIBUTE_PROCESS_URL` is a deprecated alias for
 * `ATTRIBUTE_REGISTRY_PROCESS_URL`: both point to the attribute-registry-process
 * service and feed the same API client. The canonical key is preferred; the
 * deprecated one is still accepted as a fallback (with a warning) so services
 * that have not migrated their deployment keep working.
 */
export const AttributeRegistryProcessServerConfig = z
  .object({
    ATTRIBUTE_REGISTRY_PROCESS_URL: APIEndpoint.optional(),
    ATTRIBUTE_PROCESS_URL: z.unknown().optional(),
  })
  .transform((c, ctx) => ({
    attributeRegistryProcessUrl: resolveDeprecatedAPIEndpointFallback(
      ctx,
      {
        key: "ATTRIBUTE_REGISTRY_PROCESS_URL",
        value: c.ATTRIBUTE_REGISTRY_PROCESS_URL,
      },
      { key: "ATTRIBUTE_PROCESS_URL", value: c.ATTRIBUTE_PROCESS_URL }
    ),
  }));
export type AttributeRegistryProcessServerConfig = z.infer<
  typeof AttributeRegistryProcessServerConfig
>;

export const AuthorizationProcessServerConfig = z
  .object({
    AUTHORIZATION_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    authorizationProcessUrl: c.AUTHORIZATION_PROCESS_URL,
  }));
export type AuthorizationProcessServerConfig = z.infer<
  typeof AuthorizationProcessServerConfig
>;

export const DelegationProcessServerConfig = z
  .object({
    DELEGATION_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    delegationProcessUrl: c.DELEGATION_PROCESS_URL,
  }));
export type DelegationProcessServerConfig = z.infer<
  typeof DelegationProcessServerConfig
>;

export const EServiceTemplateProcessServerConfig = z
  .object({
    ESERVICE_TEMPLATE_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    eserviceTemplateProcessUrl: c.ESERVICE_TEMPLATE_PROCESS_URL,
  }));
export type EServiceTemplateProcessServerConfig = z.infer<
  typeof EServiceTemplateProcessServerConfig
>;

export const NotificationConfigProcessServerConfig = z
  .object({
    NOTIFICATION_CONFIG_PROCESS_URL: APIEndpoint,
  })
  .transform((c) => ({
    notificationConfigProcessUrl: c.NOTIFICATION_CONFIG_PROCESS_URL,
  }));
export type NotificationConfigProcessServerConfig = z.infer<
  typeof NotificationConfigProcessServerConfig
>;
