import {
  extendZodWithOpenApi,
  OpenAPIRegistry,
  OpenApiGeneratorV3,
} from "@asteasolutions/zod-to-openapi";
import { createTypedClient, defineEndpoints } from "pagopa-interop-commons";
import { z } from "zod";
import qs from "qs";
import { configureAxiosLogInterceptors } from "./axiosLogInterceptors.js";

extendZodWithOpenApi(z);

export const TenantNotificationConfig = z
  .object({
    id: z.string().uuid(),
    tenantId: z.string().uuid(),
    enabled: z.boolean(),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .openapi("TenantNotificationConfig");
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
  .strict()
  .openapi("NotificationConfig");
export type NotificationConfig = z.infer<typeof NotificationConfig>;

export const TenantNotificationConfigSeed = z
  .object({ tenantId: z.string().uuid() })
  .strict()
  .openapi("TenantNotificationConfigSeed");
export type TenantNotificationConfigSeed = z.infer<
  typeof TenantNotificationConfigSeed
>;

export const TenantNotificationConfigUpdateSeed = z
  .object({ enabled: z.boolean() })
  .strict()
  .openapi("TenantNotificationConfigUpdateSeed");
export type TenantNotificationConfigUpdateSeed = z.infer<
  typeof TenantNotificationConfigUpdateSeed
>;

export const UserRole = z
  .enum(["ADMIN", "API", "SECURITY", "SUPPORT"])
  .openapi("UserRole");
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
  .strict()
  .openapi("ProblemError");
export type ProblemError = z.infer<typeof ProblemError>;

export const UserNotificationConfigUpdateSeed = z
  .object({
    inAppNotificationPreference: z.boolean(),
    emailNotificationPreference: z.boolean(),
    emailDigestPreference: z.boolean(),
    inAppConfig: NotificationConfig,
    emailConfig: NotificationConfig,
  })
  .strict()
  .openapi("UserNotificationConfigUpdateSeed");
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
  .strict()
  .openapi("UserNotificationConfig");
export type UserNotificationConfig = z.infer<typeof UserNotificationConfig>;

export const UserNotificationConfigSeed = z
  .object({
    userId: z.string().uuid(),
    tenantId: z.string().uuid(),
    userRoles: z.array(UserRole).min(1),
  })
  .strict()
  .openapi("UserNotificationConfigSeed");
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
  .strict()
  .openapi("Problem");
export type Problem = z.infer<typeof Problem>;

const correlationIdHeader = z.object({ "X-Correlation-Id": z.string() });

const problemResponse = (description: string) =>
  ({
    description,
    content: { "application/problem+json": { schema: Problem } },
  } as const);

export const processEndpoints = defineEndpoints([
  {
    method: "get",
    path: "/tenantNotificationConfigs",
    operationId: "getTenantNotificationConfig",
    description: "Retrieve a tenant's notification configuration",
    tags: ["process"],
    security: [{ bearerAuth: [] }],
    request: {
      headers: correlationIdHeader,
    },
    responses: {
      200: {
        description: "Retrieve a tenant's notification configuration",
        content: { "application/json": { schema: TenantNotificationConfig } },
      },
      401: problemResponse("Unauthorized"),
      403: problemResponse("Forbidden"),
      404: problemResponse("Tenant notification config not found"),
    },
  },
  {
    method: "post",
    path: "/tenantNotificationConfigs",
    operationId: "updateTenantNotificationConfig",
    description: "Update a tenant's notification configuration",
    tags: ["process"],
    security: [{ bearerAuth: [] }],
    request: {
      headers: correlationIdHeader,
      body: {
        content: {
          "application/json": { schema: TenantNotificationConfigUpdateSeed },
        },
        description: "A notification config seed",
      },
    },
    responses: {
      200: {
        description: "Update a tenant's notification configuration",
        content: { "application/json": { schema: TenantNotificationConfig } },
      },
      400: problemResponse("Invalid input"),
      401: problemResponse("Unauthorized"),
      403: problemResponse("Forbidden"),
      404: problemResponse("Tenant notification config not found"),
    },
  },
  {
    method: "post",
    path: "/internal/tenantNotificationConfigs",
    operationId: "createTenantDefaultNotificationConfig",
    description: "Create a tenant's default notification configuration",
    tags: ["process"],
    security: [{ bearerAuth: [] }],
    request: {
      headers: correlationIdHeader,
      body: {
        content: {
          "application/json": { schema: TenantNotificationConfigSeed },
        },
        description: "A tenant notification config seed",
      },
    },
    responses: {
      200: {
        description: "Create a tenant's default notification configuration",
        content: { "application/json": { schema: TenantNotificationConfig } },
      },
      400: problemResponse("Invalid input"),
      401: problemResponse("Unauthorized"),
      403: problemResponse("Forbidden"),
      409: problemResponse("Conflict"),
    },
  },
  {
    method: "delete",
    path: "/internal/tenantNotificationConfigs/tenantId/{tenantId}",
    operationId: "deleteTenantNotificationConfig",
    description: "Delete a tenant's notification configuration",
    tags: ["process"],
    security: [{ bearerAuth: [] }],
    request: {
      headers: correlationIdHeader,
      params: z.object({ tenantId: z.string().uuid() }),
    },
    responses: {
      204: { description: "Delete a tenant's notification configuration" },
      400: problemResponse("Invalid input"),
      401: problemResponse("Unauthorized"),
      403: problemResponse("Forbidden"),
      404: problemResponse("Tenant notification config not found"),
    },
  },
  {
    method: "get",
    path: "/userNotificationConfigs",
    operationId: "getUserNotificationConfig",
    description: "Retrieve a user's notification configuration",
    tags: ["process"],
    security: [{ bearerAuth: [] }],
    request: {
      headers: correlationIdHeader,
    },
    responses: {
      200: {
        description: "Retrieve a user's notification configuration",
        content: { "application/json": { schema: UserNotificationConfig } },
      },
      401: problemResponse("Unauthorized"),
      403: problemResponse("Forbidden"),
      404: problemResponse("User notification config not found"),
    },
  },
  {
    method: "post",
    path: "/userNotificationConfigs",
    operationId: "updateUserNotificationConfig",
    description: "Update a user's notification configuration",
    tags: ["process"],
    security: [{ bearerAuth: [] }],
    request: {
      headers: correlationIdHeader,
      body: {
        content: {
          "application/json": { schema: UserNotificationConfigUpdateSeed },
        },
        description: "A user notification config seed",
      },
    },
    responses: {
      200: {
        description: "Update a user's notification configuration",
        content: { "application/json": { schema: UserNotificationConfig } },
      },
      400: problemResponse("Invalid input"),
      401: problemResponse("Unauthorized"),
      403: problemResponse("Forbidden"),
      404: problemResponse("User notification config not found"),
    },
  },
  {
    method: "post",
    path: "/internal/ensureUserNotificationConfigExistsWithRoles",
    operationId: "ensureUserNotificationConfigExistsWithRoles",
    description:
      "Create a user's default notification configuration if missing or add roles to it",
    tags: ["process"],
    security: [{ bearerAuth: [] }],
    request: {
      headers: correlationIdHeader,
      body: {
        content: {
          "application/json": { schema: UserNotificationConfigSeed },
        },
        description: "A user notification config seed",
      },
    },
    responses: {
      204: {
        description:
          "Create a user's default notification configuration if missing or add roles to it",
      },
      400: problemResponse("Invalid input"),
      401: problemResponse("Unauthorized"),
      403: problemResponse("Forbidden"),
    },
  },
  {
    method: "delete",
    path: "/internal/userNotificationConfigs/tenantId/{tenantId}/userId/{userId}/userRole/{userRole}",
    operationId: "removeUserNotificationConfigRole",
    description:
      "Remove a role from the user's notification configuration or delete it if it's the only role",
    tags: ["process"],
    security: [{ bearerAuth: [] }],
    request: {
      headers: correlationIdHeader,
      params: z.object({
        tenantId: z.string().uuid(),
        userId: z.string().uuid(),
        userRole: UserRole,
      }),
    },
    responses: {
      204: {
        description:
          "Remove a role from the user's notification configuration or delete it if it's the only role",
      },
      400: problemResponse("Invalid input"),
      401: problemResponse("Unauthorized"),
      403: problemResponse("Forbidden"),
      404: problemResponse("User notification config or role not found"),
    },
  },
]);

export const processApi = { api: processEndpoints } as const;

const registry = new OpenAPIRegistry();
registry.registerComponent("securitySchemes", "bearerAuth", {
  type: "http",
  description:
    "A bearer token in the format of a JWS and comformed to the specifications included in [RFC8725](https://tools.ietf.org/html/RFC8725).",
  scheme: "bearer",
  bearerFormat: "JWT",
});
for (const route of processEndpoints) {
  registry.registerPath(route);
}

const generator = new OpenApiGeneratorV3(registry.definitions);
const openApiDocument: object = generator.generateDocument({
  openapi: "3.0.3",
  info: {
    title: "Notification Config Process Micro Service",
    description: "This service is the notification config process",
    version: "{{version}}",
    contact: {
      name: "API Support",
      url: "http://www.example.com/support",
      email: "support@example.com",
    },
    termsOfService: "http://swagger.io/terms/",
    "x-api-id": "an x-api-id" as unknown as undefined,
    "x-summary": "an x-summary" as unknown as undefined,
  },
  servers: [
    {
      url: "/",
      description: "This service is the notification config process",
    },
  ],
  security: [{ bearerAuth: [] }],
});

export { openApiDocument };

export type NotificationConfigProcessClient = ReturnType<
  typeof createProcessApiClient
>;

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
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
