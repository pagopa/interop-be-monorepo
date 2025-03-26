import { unauthorizedError } from "pagopa-interop-models";
import { AppContext, AuthData, UserRole } from "../index.js";

export function hasUserRole(
  authData: AuthData,
  userRoles: UserRole[]
): boolean {
  return (
    authData.tokenType === "ui" &&
    authData.userRoles.some((role: UserRole) => userRoles.includes(role))
  );
}

export function validateAuthorization<
  T extends Exclude<AuthData["tokenType"], "ui">
>(
  ctx: AppContext,
  tokenTypes: T[]
): asserts ctx is AppContext<Extract<AuthData, { tokenType: T }>>;
export function validateAuthorization<T extends AuthData["tokenType"]>(
  ctx: AppContext,
  tokenTypes: T[],
  admittedUserRoles: UserRole[]
): asserts ctx is AppContext<Extract<AuthData, { tokenType: T }>>;
export function validateAuthorization<T extends AuthData["tokenType"]>(
  ctx: AppContext,
  tokenTypes: T[],
  admittedUserRoles?: UserRole[]
): asserts ctx is AppContext<Extract<AuthData, { tokenType: T }>> {
  const { authData } = ctx;
  if (!tokenTypes.includes(authData.tokenType as T)) {
    throw unauthorizedError(
      `Invalid token type '${authData.tokenType}' for this operation`
    );
  }

  if (authData.tokenType === "ui") {
    if (!admittedUserRoles) {
      throw unauthorizedError(
        "Must provide admittedUserRoles when tokenType includes 'ui'"
      );
    }

    const hasRole = authData.userRoles.some((role) =>
      admittedUserRoles.includes(role)
    );
    if (!hasRole) {
      throw unauthorizedError(
        `Invalid token type '${authData.tokenType}' and user roles ${authData.userRoles} for this operation`
      );
    }
  }
}
