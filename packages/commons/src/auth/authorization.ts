import { unauthorizedError } from "pagopa-interop-models";
import { match } from "ts-pattern";
import { AppContext } from "../context/context.js";
import { NonEmptyArray } from "../index.js";
import {
  UserRole,
  UIAuthData,
  M2MAuthData,
  InternalAuthData,
  MaintenanceAuthData,
  AuthData,
} from "./authData.js";

// System roles = special non-UI tokens
type SystemRole = "m2m" | "internal" | "maintenance";
type AuthRole = UserRole | SystemRole;

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

export function validateAuthorization<
  AdmittedRoles extends NonEmptyArray<AuthRole>
>(
  ctx: AppContext,
  admittedAuthRoles: AdmittedRoles
): asserts ctx is AppContext<AllowedAuthData<AdmittedRoles>> {
  const { authData } = ctx;

  match(authData)
    .with(
      { tokenType: "m2m" },
      { tokenType: "internal" },
      { tokenType: "maintenance" },
      ({ tokenType }) => {
        const admittedSystemRoles: SystemRole[] =
          admittedAuthRoles.filter(isSystemRole);
        if (!admittedSystemRoles.includes(tokenType)) {
          throw unauthorizedError(
            `Invalid token type '${tokenType}' for this operation`
          );
        }
      }
    )
    .with({ tokenType: "ui" }, (authData) => {
      const admittedUserRoles: UserRole[] =
        admittedAuthRoles.filter(isUserRole);

      if (admittedUserRoles.length === 0) {
        throw unauthorizedError(
          `Invalid token type '${authData.tokenType}' for this operation`
        );
      }

      if (!hasAtLeastOneUserRole(authData, admittedUserRoles)) {
        throw unauthorizedError(
          `Invalid token type '${
            authData.tokenType
          }' and user roles ${JSON.stringify(
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

function isUiAuthData(authData: AuthData): authData is UIAuthData {
  return match(authData)
    .with({ tokenType: "ui" }, () => true)
    .with({ tokenType: "m2m" }, () => false)
    .with({ tokenType: "internal" }, () => false)
    .with({ tokenType: "maintenance" }, () => false)
    .exhaustive();
}
function isSystemRole(role: AuthRole): role is SystemRole {
  return match(role)
    .with("m2m", "internal", "maintenance", () => true)
    .with("admin", "security", "api", "support", () => false)
    .exhaustive();
}

function isUserRole(role: AuthRole): role is UserRole {
  return match(role)
    .with("admin", "security", "api", "support", () => true)
    .with("m2m", "internal", "maintenance", () => false)
    .exhaustive();
}

// EXAMPLE USAGES -- UNCOMMENT EACH ENTIRE EXAMPLE TO TEST IT:

// EXAMPLE 1 - UI with one user role
// const mockContext = {} as AppContext;
// /* eslint-disable @typescript-eslint/no-unused-vars */
// validateAuthorizationByAuthRoles(mockContext, ["admin"]); // compiles
// const tokenType = mockContext.authData.tokenType; // compiles and is "ui"
// const orgId = mockContext.authData.organizationId; // compiles
// const userId = mockContext.authData.userId; // compiles
// -------------------------------------------------------

// EXAMPLE 2 - UI with multiple user roles
// const mockContext = {} as AppContext;
// /* eslint-disable @typescript-eslint/no-unused-vars */
// validateAuthorizationByAuthRoles(mockContext, ["admin", "security", "api"]); // compiles
// const tokenType = mockContext.authData.tokenType; // compiles and is "ui"
// const orgId = mockContext.authData.organizationId; // compiles
// const userId = mockContext.authData.userId; // compiles
// -------------------------------------------------------

// EXAMPLE 3 - M2M
// const mockContext = {} as AppContext;
// /* eslint-disable @typescript-eslint/no-unused-vars */
// validateAuthorizationByAuthRoles(mockContext, ["m2m"]); // compiles
// const tokenType = mockContext.authData.tokenType; // compiles and is "m2m"
// const orgId = mockContext.authData.organizationId; // compiles
// const userId = mockContext.authData.userId; // TS error: userId is not available in M2M context
// -------------------------------------------------------

// EXAMPLE 4 - Internal
// const mockContext = {} as AppContext;
// /* eslint-disable @typescript-eslint/no-unused-vars */
// validateAuthorizationByAuthRoles(mockContext, ["internal"]); // compiles
// const tokenType = mockContext.authData.tokenType; // compiles and is "internal"
// const orgId = mockContext.authData.organizationId; // TS error: organizationId is not available in Internal context
// const userId = mockContext.authData.userId; // TS error: userId is not available in Internal context
// -------------------------------------------------------

// EXAMPLE 5 - Maintenance
// const mockContext = {} as AppContext;
// /* eslint-disable @typescript-eslint/no-unused-vars */
// validateAuthorizationByAuthRoles(mockContext, ["maintenance"]); // compiles
// const tokenType = mockContext.authData.tokenType; // compiles and is "maintenance"
// const orgId = mockContext.authData.organizationId; // TS error: organizationId is not available in Maintenance context
// const userId = mockContext.authData.userId; // TS error: userId is not available in Maintenance context
// -------------------------------------------------------

// EXAMPLE 6 - M2M and UI with one user role
// const mockContext = {} as AppContext;
// /* eslint-disable @typescript-eslint/no-unused-vars */
// validateAuthorizationByAuthRoles(mockContext, ["m2m", "admin"]); // compiles
// const tokenType = mockContext.authData.tokenType; // compiles and is "m2m" or "ui"
// const orgId = mockContext.authData.organizationId; // compiles
// const userId = mockContext.authData.userId; // TS error: userId is not available in M2M context
// -------------------------------------------------------

// EXAMPLE 7 - M2M and UI with multiple user roles
// const mockContext = {} as AppContext;
// /* eslint-disable @typescript-eslint/no-unused-vars */
// validateAuthorizationByAuthRoles(mockContext, ["m2m", "admin", "security"]); // compiles
// const tokenType = mockContext.authData.tokenType; // compiles and is "m2m" or "ui"
// const orgId = mockContext.authData.organizationId; // compiles
// const userId = mockContext.authData.userId; // TS error: userId is not available in M2M context
// -------------------------------------------------------

// EXAMPLE 8 - M2M and Internal
// const mockContext = {} as AppContext;
// /* eslint-disable @typescript-eslint/no-unused-vars */
// validateAuthorizationByAuthRoles(mockContext, ["m2m", "internal"]); // compiles
// const tokenType = mockContext.authData.tokenType; // compiles and is "m2m" or "internal"
// const orgId = mockContext.authData.organizationId; // TS error: organizationId is not available in Internal context
// const userId = mockContext.authData.userId; // TS error: userId is not available in Internal context
// -------------------------------------------------------

// EXAMPLE 9 - M2M and Internal and UI with multiple user roles
// const mockContext = {} as AppContext;
// /* eslint-disable @typescript-eslint/no-unused-vars */
// validateAuthorizationByAuthRoles(mockContext, [
//   "m2m",
//   "internal",
//   "admin",
//   "security",
// ]); // compiles
// const tokenType = mockContext.authData.tokenType; // compiles and is "m2m" or "internal" or "ui"
// const orgId = mockContext.authData.organizationId; // TS error: organizationId is not available in Internal context
// const userId = mockContext.authData.userId; // TS error: userId is not available in Internal context
// -------------------------------------------------------
