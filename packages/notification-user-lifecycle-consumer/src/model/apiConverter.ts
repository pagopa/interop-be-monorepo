import { match } from "ts-pattern";
import { notificationConfigApi } from "pagopa-interop-api-clients";
import { UserRole, userRole } from "pagopa-interop-models";

export function userRoleToApiUserRole(
  role: UserRole
): notificationConfigApi.UserRole {
  return match(role)
    .with(userRole.ADMIN_ROLE, () => "ADMIN" as const)
    .with(userRole.API_ROLE, () => "API" as const)
    .with(userRole.SECURITY_ROLE, () => "SECURITY" as const)
    .with(userRole.SUPPORT_ROLE, () => "SUPPORT" as const)
    .exhaustive();
}
