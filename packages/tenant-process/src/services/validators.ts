// import { AuthData, userRoles } from "pagopa-interop-commons";
import {
  Tenant,
  WithMetadata,
  //   operationForbidden,
  tenantIdNotFound,
} from "pagopa-interop-models";

export function assertTenantExist(
  tenantId: string,
  tenant: WithMetadata<Tenant> | undefined
): asserts tenant is NonNullable<WithMetadata<Tenant>> {
  if (tenant === undefined) {
    throw tenantIdNotFound(tenantId);
  }
}

// async function assertRequesterAllowed(
//   resourceId: string,
//   requesterId: string
// ): Promise<void> {
//   if (resourceId !== requesterId) {
//     throw operationForbidden;
//   }
// }

// async function assertResourceAllowed(
//   resourceId: string,
//   authData: AuthData
// ): Promise<void> {
//   const roles = authData.userRoles;
//   const organizationId = authData.organizationId;

//   await assertRequesterAllowed(resourceId, organizationId);

//   if (!roles.includes(userRoles.INTERNAL_ROLE)) {
//     throw operationForbidden;
//   }
// }
