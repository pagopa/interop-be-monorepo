// import { AuthData, userRoles } from "pagopa-interop-commons";
import {
  ExternalId,
  Tenant,
  TenantKind,
  WithMetadata,
  //   operationForbidden,
  tenantIdNotFound,
} from "pagopa-interop-models";
import { match } from "ts-pattern";

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
  if (
    externalId.origin === PUBLIC_ADMINISTRATIONS_IDENTIFIER &&
    attributes.some(
      (attr) =>
        attr.origin === PUBLIC_ADMINISTRATIONS_IDENTIFIER &&
        (attr.value === PUBLIC_SERVICES_MANAGERS ||
          attr.value === CONTRACT_AUTHORITY_PUBLIC_SERVICES_MANAGERS)
    )
  ) {
    return TenantKind.enum.GSP;
  } else {
    return TenantKind.enum.PRIVATE;
  }

  // return match(externalId.origin)
  //   .with(
  //     PUBLIC_ADMINISTRATIONS_IDENTIFIER,
  //     () => {
  //       attributes.some(
  //         (attr) =>
  //           attr.origin === PUBLIC_ADMINISTRATIONS_IDENTIFIER &&
  //           (attr.value === PUBLIC_SERVICES_MANAGERS ||
  //             attr.value === CONTRACT_AUTHORITY_PUBLIC_SERVICES_MANAGERS)
  //       );
  //     },
  //     () => TenantKind.enum.GSP
  //   )
  //   .otherwise(() => TenantKind.enum.PRIVATE);
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
