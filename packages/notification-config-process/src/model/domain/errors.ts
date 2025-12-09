import {
  ApiError,
  TenantId,
  UserId,
  UserRole,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  tenantNotificationConfigNotFound: "0001",
  userNotificationConfigNotFound: "0002",
  tenantNotificationConfigAlreadyExists: "0003",
  userRoleNotInUserNotificationConfig: "0004",
  notificationConfigNotAllowedForUserRoles: "0005",
};

export type ErrorCodes = keyof typeof errorCodes;

export const makeApiProblem = makeApiProblemBuilder(errorCodes);

export function tenantNotificationConfigNotFound(
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant notification config for tenant ${tenantId} not found`,
    code: "tenantNotificationConfigNotFound",
    title: "Tenant notification config not found",
  });
}

export function userNotificationConfigNotFound(
  userId: UserId,
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User notification config for user ${userId} in tenant ${tenantId} not found`,
    code: "userNotificationConfigNotFound",
    title: "User notification config not found",
  });
}

export function tenantNotificationConfigAlreadyExists(
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Tenant notification config for tenant ${tenantId} already exists`,
    code: "tenantNotificationConfigAlreadyExists",
    title: "Tenant notification config already exists",
  });
}

export function userRoleNotInUserNotificationConfig(
  userId: UserId,
  tenantId: TenantId,
  userRole: UserRole
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `User notification config for user ${userId} in tenant ${tenantId} does not include role ${userRole}`,
    code: "userRoleNotInUserNotificationConfig",
    title: "User notification config does not include role",
  });
}

export function notificationConfigNotAllowedForUserRoles(
  userId: UserId,
  tenantId: TenantId
): ApiError<ErrorCodes> {
  return new ApiError({
    detail: `Notification config not allowed for user ${userId} in tenant ${tenantId} due to role restrictions`,
    code: "notificationConfigNotAllowedForUserRoles",
    title: "Notification config not allowed due to role restrictions",
  });
}
