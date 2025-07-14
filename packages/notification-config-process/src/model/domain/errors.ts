import {
  ApiError,
  TenantId,
  UserId,
  makeApiProblemBuilder,
} from "pagopa-interop-models";

export const errorCodes = {
  tenantNotificationConfigNotFound: "0001",
  userNotificationConfigNotFound: "0002",
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
