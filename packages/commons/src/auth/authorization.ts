import { unauthorizedError } from "pagopa-interop-models";
import { match, P } from "ts-pattern";
import { z } from "zod";
import { AppContext } from "../context/context.js";
import { NonEmptyArray } from "../utils/arrays.js";
import {
  AuthData,
  InternalAuthData,
  M2MAdminAuthData,
  M2MAuthData,
  MaintenanceAuthData,
  UIAuthData,
} from "./authData.js";
import { userRole, UserRole, systemRole, SystemRole } from "./roles.js";

export const authRole = {
  ...userRole,
  ...systemRole,
};
export const AuthRole = z.enum([
  Object.values(authRole)[0],
  ...Object.values(authRole).slice(1),
]);
export type AuthRole = z.infer<typeof AuthRole>;

type ContainsAuthRole<
  Arr extends AuthRole[],
  V extends AuthRole
> = Arr extends [infer Head, ...infer Tail extends AuthRole[]]
  ? Head extends V
    ? true
    : ContainsAuthRole<Tail, V>
  : false;

type ExtractUserRoles<Arr extends NonEmptyArray<AuthRole>> = Exclude<
  Arr[number],
  SystemRole
>;

type AllowedAuthData<AdmittedRoles extends NonEmptyArray<AuthRole>> =
  // If "m2m" is in the array, add M2MAuthData
  | ([ContainsAuthRole<AdmittedRoles, "m2m">] extends [true]
      ? M2MAuthData
      : never)
  // If "m2m-admin" is in the array, add M2MAdminAuthData
  | ([ContainsAuthRole<AdmittedRoles, "m2m-admin">] extends [true]
      ? M2MAdminAuthData
      : never)
  // If "internal" is in the array, add InternalAuthData
  | ([ContainsAuthRole<AdmittedRoles, "internal">] extends [true]
      ? InternalAuthData
      : never)
  // If "maintenance" is in the array, add MaintenanceAuthData
  | ([ContainsAuthRole<AdmittedRoles, "maintenance">] extends [true]
      ? MaintenanceAuthData
      : never)
  // If there are user roles in the array, add UIAuthData
  | ([ExtractUserRoles<AdmittedRoles>] extends [never] ? never : UIAuthData);

/**
  ---- EXAMPLE USAGE: ----
  validateAuthorization(context, [
    authRole.M2M_ROLE,
    authRole.ADMIN_ROLE,
    authRole.SECURITY_ROLE,
  ]);
  // ^ It will throw an unauthorizedError if the context does not have at least one of
  // the roles "m2m", "admin", or "security".
  // If the function succeeds, context.authData is narrowed to either M2MAuthData or UIAuthData.
 
  const sysRole = mockContext.authData.systemRole;
      // ^ TS refines this to "m2m" | undefined: the function correctly refines the type
      // of the context to be either M2MAuthData with systemRole "m2m" or UIAuthData with
      // systemRole undefined
  const orgId = mockContext.authData.organizationId;
      // ^ compiles, because organizationId is present both in M2M and UI AuthData
  const userId = mockContext.authData.userId;
      // ^ TS error: userId is not present in M2M AuthData
  -------------------------------------------------------
 */
export function validateAuthorization<
  AdmittedRoles extends NonEmptyArray<AuthRole>
>(
  ctx: AppContext,
  admittedAuthRoles: AdmittedRoles
): asserts ctx is AppContext<AllowedAuthData<AdmittedRoles>> {
  const { authData } = ctx;

  match(authData)
    .with(
      {
        systemRole: P.union(
          systemRole.M2M_ADMIN_ROLE,
          systemRole.INTERNAL_ROLE,
          systemRole.MAINTENANCE_ROLE,
          systemRole.M2M_ROLE
        ),
      },
      ({ systemRole }) => {
        const admittedSystemRoles: SystemRole[] =
          admittedAuthRoles.filter(isSystemRole);
        if (!admittedSystemRoles.includes(systemRole)) {
          /**
           * In case of M2M calls, provide a more meaningful error message
           * about the possible causes of the authorization failure.
           */
          throwMeaningfulMessageForM2MCalls(authData, admittedSystemRoles);
          throw unauthorizedError(
            `Invalid role "${systemRole}" for this operation`
          );
        }
      }
    )
    .with({ systemRole: undefined }, (authData) => {
      const admittedUserRoles: UserRole[] =
        admittedAuthRoles.filter(isUserRole);

      if (
        admittedUserRoles.length === 0 ||
        !hasAtLeastOneUserRole(authData, admittedUserRoles)
      ) {
        throw unauthorizedError(
          `Invalid roles ${JSON.stringify(
            authData.userRoles
          )} for this operation`
        );
      }
    })
    .exhaustive();
}

export function hasAtLeastOneUserRole(
  authData: AuthData,
  admittedUserRoles: ReadonlyArray<UserRole>
): boolean {
  return (
    isUiAuthData(authData) &&
    authData.userRoles.some((role: UserRole) =>
      admittedUserRoles.includes(role)
    )
  );
}

export function hasAtLeastOneSystemRole(
  authData: AuthData,
  admittedSystemRoles: ReadonlyArray<SystemRole>
): boolean {
  return (
    !isUiAuthData(authData) && admittedSystemRoles.includes(authData.systemRole)
  );
}

export function isUiAuthData(authData: AuthData): authData is UIAuthData {
  return match(authData)
    .with({ systemRole: undefined }, () => true)
    .with(
      {
        systemRole: P.union(
          systemRole.M2M_ROLE,
          systemRole.INTERNAL_ROLE,
          systemRole.MAINTENANCE_ROLE,
          systemRole.M2M_ADMIN_ROLE
        ),
      },
      () => false
    )
    .exhaustive();
}

function isSystemRole(role: AuthRole): role is SystemRole {
  return match(role)
    .with(
      authRole.M2M_ROLE,
      authRole.INTERNAL_ROLE,
      authRole.MAINTENANCE_ROLE,
      authRole.M2M_ADMIN_ROLE,
      () => true
    )
    .with(
      authRole.ADMIN_ROLE,
      authRole.SECURITY_ROLE,
      authRole.API_ROLE,
      authRole.SUPPORT_ROLE,
      () => false
    )
    .exhaustive();
}

function isUserRole(role: AuthRole): role is UserRole {
  return match(role)
    .with(
      authRole.ADMIN_ROLE,
      authRole.SECURITY_ROLE,
      authRole.API_ROLE,
      authRole.SUPPORT_ROLE,
      () => true
    )
    .with(
      authRole.M2M_ROLE,
      authRole.INTERNAL_ROLE,
      authRole.MAINTENANCE_ROLE,
      authRole.M2M_ADMIN_ROLE,
      () => false
    )
    .exhaustive();
}

/**
 * If the call is made with "m2m" role but the permitted roles include
 * "m2m-admin", it means that the user generated the token for a client that
 * was missing an admin user.
 * Throw a more meaningful error message in this case.
 */
function throwMeaningfulMessageForM2MCalls(
  authData: AuthData,
  permittedRoles: AuthRole[]
): void {
  if (
    authData.systemRole === authRole.M2M_ROLE &&
    permittedRoles.includes(authRole.M2M_ADMIN_ROLE)
  ) {
    throw unauthorizedError(
      `Admin user not set for Client ${authData.clientId} with M2M role. In case it is already set, regenerate the m2m token.`
    );
  }
}
