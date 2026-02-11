import { makeApi, createTypedClient } from "pagopa-interop-commons";
import { z } from "zod";
import qs from "qs";
import { configureAxiosLogInterceptors } from "../axiosLogInterceptors.js";

export const TenantNotificationConfig = z
  .object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    enabled: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();
export type TenantNotificationConfig = z.infer<typeof TenantNotificationConfig>;

export const NotificationConfig = z
  .object({
    agreementSuspendedUnsuspendedToProducer: z.boolean(),
    agreementManagementToProducer: z.boolean(),
    clientAddedRemovedToProducer: z.boolean(),
    purposeStatusChangedToProducer: z.boolean(),
    templateStatusChangedToProducer: z.boolean(),
    agreementSuspendedUnsuspendedToConsumer: z.boolean(),
    eserviceStateChangedToConsumer: z.boolean(),
    agreementActivatedRejectedToConsumer: z.boolean(),
    purposeActivatedRejectedToConsumer: z.boolean(),
    purposeSuspendedUnsuspendedToConsumer: z.boolean(),
    newEserviceTemplateVersionToInstantiator: z.boolean(),
    eserviceTemplateNameChangedToInstantiator: z.boolean(),
    eserviceTemplateStatusChangedToInstantiator: z.boolean(),
    delegationApprovedRejectedToDelegator: z.boolean(),
    eserviceNewVersionSubmittedToDelegator: z.boolean(),
    eserviceNewVersionApprovedRejectedToDelegate: z.boolean(),
    delegationSubmittedRevokedToDelegate: z.boolean(),
    certifiedVerifiedAttributeAssignedRevokedToAssignee: z.boolean(),
    clientKeyAddedDeletedToClientUsers: z.boolean(),
    producerKeychainKeyAddedDeletedToClientUsers: z.boolean(),
    purposeQuotaAdjustmentRequestToProducer: z.boolean(),
    purposeOverQuotaStateToConsumer: z.boolean(),
  })
  .strict();
export type NotificationConfig = z.infer<typeof NotificationConfig>;

export const TenantNotificationConfigSeed = z
  .object({ tenantId: z.string().uuid() })
  .strict();
export type TenantNotificationConfigSeed = z.infer<
  typeof TenantNotificationConfigSeed
>;

export const TenantNotificationConfigUpdateSeed = z
  .object({ enabled: z.boolean() })
  .strict();
export type TenantNotificationConfigUpdateSeed = z.infer<
  typeof TenantNotificationConfigUpdateSeed
>;

export const UserRole = z.enum(["ADMIN", "API", "SECURITY", "SUPPORT"]);
export type UserRole = z.infer<typeof UserRole>;

export const ProblemError = z
  .object({
    code: z
      .string()
      .min(8)
      .max(8)
      .regex(/^[0-9]{3}-[0-9]{4}$/),
    detail: z
      .string()
      .max(4096)
      .regex(/^.{0,1024}$/),
  })
  .strict();
export type ProblemError = z.infer<typeof ProblemError>;

export const UserNotificationConfigUpdateSeed = z
  .object({
    inAppNotificationPreference: z.boolean(),
    emailNotificationPreference: z.boolean(),
    emailDigestPreference: z.boolean(),
    inAppConfig: NotificationConfig,
    emailConfig: NotificationConfig,
  })
  .strict();
export type UserNotificationConfigUpdateSeed = z.infer<
  typeof UserNotificationConfigUpdateSeed
>;

export const UserNotificationConfig = z
  .object({
    id: z.string().uuid(),
    userId: z.string().uuid(),
    tenantId: z.string().uuid(),
    userRoles: z.array(UserRole).min(1),
    inAppNotificationPreference: z.boolean(),
    emailNotificationPreference: z.boolean(),
    emailDigestPreference: z.boolean(),
    inAppConfig: NotificationConfig,
    emailConfig: NotificationConfig,
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict();
export type UserNotificationConfig = z.infer<typeof UserNotificationConfig>;

export const UserNotificationConfigSeed = z
  .object({
    userId: z.string().uuid(),
    tenantId: z.string().uuid(),
    userRoles: z.array(UserRole).min(1),
  })
  .strict();
export type UserNotificationConfigSeed = z.infer<
  typeof UserNotificationConfigSeed
>;

export const Problem = z
  .object({
    type: z.string(),
    status: z.number().int().gte(100).lt(600),
    title: z
      .string()
      .max(64)
      .regex(/^[ -~]{0,64}$/),
    correlationId: z.string().max(64).optional(),
    detail: z
      .string()
      .max(4096)
      .regex(/^.{0,1024}$/)
      .optional(),
    errors: z.array(ProblemError).min(1).optional(),
  })
  .strict();
export type Problem = z.infer<typeof Problem>;

export const processEndpoints = makeApi([
  {
    method: "get",
    path: "/tenantNotificationConfigs",
    alias: "getTenantNotificationConfig",
    description: `Retrieve a tenant's notification configuration`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
    ],
    response: TenantNotificationConfig,
    errors: [
      {
        status: 401,
        description: `Unauthorized`,
        schema: Problem,
      },
      {
        status: 403,
        description: `Forbidden`,
        schema: Problem,
      },
      {
        status: 404,
        description: `Tenant notification config not found`,
        schema: Problem,
      },
    ],
  },
  {
    method: "post",
    path: "/tenantNotificationConfigs",
    alias: "updateTenantNotificationConfig",
    description: `Update a tenant's notification configuration`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "body",
        description: `A notification config seed`,
        type: "Body",
        schema: TenantNotificationConfigUpdateSeed,
      },
    ],
    response: TenantNotificationConfig,
    errors: [
      {
        status: 400,
        description: `Invalid input`,
        schema: Problem,
      },
      {
        status: 401,
        description: `Unauthorized`,
        schema: Problem,
      },
      {
        status: 403,
        description: `Forbidden`,
        schema: Problem,
      },
      {
        status: 404,
        description: `Tenant notification config not found`,
        schema: Problem,
      },
    ],
  },
  {
    method: "post",
    path: "/internal/tenantNotificationConfigs",
    alias: "createTenantDefaultNotificationConfig",
    description: `Create a tenant's default notification configuration`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "body",
        description: `A tenant notification config seed`,
        type: "Body",
        schema: TenantNotificationConfigSeed,
      },
    ],
    response: TenantNotificationConfig,
    errors: [
      {
        status: 400,
        description: `Invalid input`,
        schema: Problem,
      },
      {
        status: 401,
        description: `Unauthorized`,
        schema: Problem,
      },
      {
        status: 403,
        description: `Forbidden`,
        schema: Problem,
      },
      {
        status: 409,
        description: `Conflict`,
        schema: Problem,
      },
    ],
  },
  {
    method: "delete",
    path: "/internal/tenantNotificationConfigs/tenantId/:tenantId",
    alias: "deleteTenantNotificationConfig",
    description: `Delete a tenant's notification configuration`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "tenantId",
        type: "Path",
        schema: z.string().uuid(),
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `Invalid input`,
        schema: Problem,
      },
      {
        status: 401,
        description: `Unauthorized`,
        schema: Problem,
      },
      {
        status: 403,
        description: `Forbidden`,
        schema: Problem,
      },
      {
        status: 404,
        description: `Tenant notification config not found`,
        schema: Problem,
      },
    ],
  },
  {
    method: "get",
    path: "/userNotificationConfigs",
    alias: "getUserNotificationConfig",
    description: `Retrieve a user's notification configuration`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
    ],
    response: UserNotificationConfig,
    errors: [
      {
        status: 401,
        description: `Unauthorized`,
        schema: Problem,
      },
      {
        status: 403,
        description: `Forbidden`,
        schema: Problem,
      },
      {
        status: 404,
        description: `User notification config not found`,
        schema: Problem,
      },
    ],
  },
  {
    method: "post",
    path: "/userNotificationConfigs",
    alias: "updateUserNotificationConfig",
    description: `Update a user's notification configuration`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "body",
        description: `A user notification config seed`,
        type: "Body",
        schema: UserNotificationConfigUpdateSeed,
      },
    ],
    response: UserNotificationConfig,
    errors: [
      {
        status: 400,
        description: `Invalid input`,
        schema: Problem,
      },
      {
        status: 401,
        description: `Unauthorized`,
        schema: Problem,
      },
      {
        status: 403,
        description: `Forbidden`,
        schema: Problem,
      },
      {
        status: 404,
        description: `User notification config not found`,
        schema: Problem,
      },
    ],
  },
  {
    method: "post",
    path: "/internal/ensureUserNotificationConfigExistsWithRoles",
    alias: "ensureUserNotificationConfigExistsWithRoles",
    description: `Create a user's default notification configuration if missing or add roles to it`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "body",
        description: `A user notification config seed`,
        type: "Body",
        schema: UserNotificationConfigSeed,
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `Invalid input`,
        schema: Problem,
      },
      {
        status: 401,
        description: `Unauthorized`,
        schema: Problem,
      },
      {
        status: 403,
        description: `Forbidden`,
        schema: Problem,
      },
    ],
  },
  {
    method: "delete",
    path: "/internal/userNotificationConfigs/tenantId/:tenantId/userId/:userId/userRole/:userRole",
    alias: "removeUserNotificationConfigRole",
    description: `Remove a role from the user's notification configuration or delete it if it's the only role`,
    requestFormat: "json",
    parameters: [
      {
        name: "X-Correlation-Id",
        type: "Header",
        schema: z.string(),
      },
      {
        name: "tenantId",
        type: "Path",
        schema: z.string().uuid(),
      },
      {
        name: "userId",
        type: "Path",
        schema: z.string().uuid(),
      },
      {
        name: "userRole",
        type: "Path",
        schema: UserRole,
      },
    ],
    response: z.void(),
    errors: [
      {
        status: 400,
        description: `Invalid input`,
        schema: Problem,
      },
      {
        status: 401,
        description: `Unauthorized`,
        schema: Problem,
      },
      {
        status: 403,
        description: `Forbidden`,
        schema: Problem,
      },
      {
        status: 404,
        description: `User notification config or role not found`,
        schema: Problem,
      },
    ],
  },
]);

export const processApi = { api: processEndpoints } as const;

export type NotificationConfigProcessClient = ReturnType<
  typeof createProcessApiClient
>;

export function createProcessApiClient(baseUrl: string) {
  const client = createTypedClient(baseUrl, processEndpoints, {
    paramsSerializer: (params) =>
      qs.stringify(params, { arrayFormat: "comma" }),
  });

  configureAxiosLogInterceptors(
    client.axios,
    "NotificationConfigApi Process Client"
  );

  return client;
}
