// import { AuthData, userRoles } from "pagopa-interop-commons";
import { match } from "ts-pattern";
import {
  ExternalId,
  Tenant,
  TenantKind,
  WithMetadata,
  //   operationForbidden,
  tenantIdNotFound,
  tenantKind,
} from "pagopa-interop-models";

export function assertTenantExist(
  tenantId: string,
  tenant: WithMetadata<Tenant> | undefined
): asserts tenant is NonNullable<WithMetadata<Tenant>> {
  if (tenant === undefined) {
    throw tenantIdNotFound(tenantId);
  }
}

const PUBLIC_ADMINISTRATIONS_IDENTIFIER = "IPA";
const CONTRACT_AUTHORITY_PUBLIC_SERVICES_MANAGERS = "SAG";
const PUBLIC_SERVICES_MANAGERS = "L37";

export function getTenantKind(
  attributes: ExternalId[],
  externalId: ExternalId
): TenantKind {
  return match(externalId.origin)
    .with(
      PUBLIC_ADMINISTRATIONS_IDENTIFIER,
      // condition to be satisfied
      (origin) =>
        attributes.some(
          (attr) =>
            attr.origin === origin &&
            (attr.value === PUBLIC_SERVICES_MANAGERS ||
              attr.value === CONTRACT_AUTHORITY_PUBLIC_SERVICES_MANAGERS)
        ),
      () => tenantKind.GSP
    )
    .with(PUBLIC_ADMINISTRATIONS_IDENTIFIER, () => tenantKind.PA)
    .otherwise(() => tenantKind.PRIVATE);
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
