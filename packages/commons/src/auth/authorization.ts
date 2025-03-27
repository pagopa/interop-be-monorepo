import { unauthorizedError } from "pagopa-interop-models";
import { AppContext, AuthData, UserRole } from "../index.js";

export function hasUserRole(
  authData: AuthData,
  admittedUiUserRoles: ReadonlyArray<UserRole>
): boolean {
  return (
    authData.tokenType === "ui" &&
    authData.userRoles.some((role: UserRole) =>
      admittedUiUserRoles.includes(role)
    )
  );
}

type NonEmptyArray<T> = [T, ...T[]];
type TokenType = AuthData["tokenType"];

/**
 * Validates the authorization token in a given `AppContext`.
 *
 * This function has two overloads:
 *
 * 1. **Overload #1**: if you admit *only* non‐`"ui"` token types, you must omit
 *    the `admittedUiUserRoles` parameter.
 *
 * 2. **Overload #2**: if `"ui"` is included among your admitted token types,
 *    you must pass a non‐empty array of user roles.
 *
 * @remarks
 * - In either case, if the actual token type doesn’t match the admitted types,
 *   an error is thrown.
 * - If `"ui"` is admitted and the actual token is `"ui"`, then at least one
 *   of the user’s roles must be in the `admittedUiUserRoles` array.
 */

/**
 *
 * Overload #1: Checking auth for non‐"ui" token types.
 *
 * @param ctx - The application context containing the AuthData.
 * @param admittedTokenTypes - An array of token types that DOES NOT include "ui".
 * @param admittedUiUserRoles - Not allowed in this overload, no "ui" token = no user roles to check
 *
 * @example
 * validateAuthorization(mockContext, ["m2m"]);
 * validateAuthorization(mockContext, ["internal", "m2m"]);
 * validateAuthorization(mockContext, ["maintenance", "m2m", "internal"]);
 *
 * @throws {UnauthorizedError} - If the token type is not in the admitted list.
 */
export function validateAuthorization<
  T extends NonEmptyArray<Exclude<TokenType, "ui">>
>(
  ctx: AppContext,
  admittedTokenTypes: T,
  admittedUiUserRoles?: never
): asserts ctx is AppContext<Extract<AuthData, { tokenType: T[number] }>>;

/**
 *
 * Overload #2: Checking auth for cases where "ui" token types are involved.
 *
 * @param ctx - The application context containing the AuthData.
 * @param admittedTokenTypes - An array of token types that includes "ui".
 * @param admittedUiUserRoles - An array of "ui" user roles that are allowed to access the operation.
 *
 * @example
 * validateAuthorization(mockContext, ["ui"], ["admin"]);
 * validateAuthorization(mockContext, ["ui", "m2m"], ["admin"]);
 * validateAuthorization(mockContext, ["ui", "internal"], ["admin", "security"]);
 *
 * @throws {UnauthorizedError} - If the token type is not in the admitted list,
 * or if the token type is "ui" and there is no intersection between the user roles and the admitted user roles.
 */
export function validateAuthorization<T extends NonEmptyArray<TokenType>>(
  ctx: AppContext,
  admittedTokenTypes: "ui" extends T[number] ? T : never,
  admittedUiUserRoles: NonEmptyArray<UserRole>
): asserts ctx is AppContext<Extract<AuthData, { tokenType: T[number] }>>;

/**
 * **Implementation**: merges the two overloads.
 * Do *not* call this signature directly; it’s just the shared runtime logic.
 */
export function validateAuthorization<
  T extends NonEmptyArray<AuthData["tokenType"]>
>(
  ctx: AppContext,
  admittedTokenTypes: T,
  admittedUiUserRoles?: ReadonlyArray<UserRole>
): void {
  const { authData } = ctx;

  // 1) Check token type is in the admitted list:
  if (!admittedTokenTypes.includes(authData.tokenType)) {
    throw unauthorizedError(
      `Invalid token type "${authData.tokenType}" for this operation`
    );
  }

  // 2) If "ui" is in the admitted token types and the token is actually "ui",
  // ensure we have a non-empty admitted user-roles array and that the user has a matching role.
  if (admittedTokenTypes.includes("ui") && authData.tokenType === "ui") {
    if (!admittedUiUserRoles || admittedUiUserRoles.length === 0) {
      throw unauthorizedError(
        `Must provide admittedUiUserRoles when validating authorization for "ui" token type`
      );
    }

    if (!hasUserRole(authData, admittedUiUserRoles)) {
      throw unauthorizedError(
        `Invalid token type "${
          authData.tokenType
        }" and user roles ${JSON.stringify(
          authData.userRoles
        )} for this operation`
      );
    }
  }
}

// EXAMPLE USAGES THAT COMPILE (UNCOMMENT TO TEST):
// validateAuthorization(mockContext, ["ui"], ["admin"]);
// validateAuthorization(mockContext, ["ui", "m2m"], ["admin"]);
// validateAuthorization(mockContext, ["ui", "m2m"], ["admin", "security"]);
// validateAuthorization(mockContext, ["m2m"]);
// validateAuthorization(mockContext, ["internal"]);
// validateAuthorization(mockContext, ["maintenance"]);
// validateAuthorization(mockContext, ["m2m", "internal"]);

// EXAMPLE USAGES THAT DO NOT COMPILE (UNCOMMENT TO TEST):

// validateAuthorization(mockContext, ["ui", "m2m", "internal"], []);
// validateAuthorization(mockContext, ["ui"], []);
// ^^ no admittedUiUserRoles provided, but "ui" is in the admitted token types

// validateAuthorization(mockContext, ["m2m", "internal", "maintenance"], []);
// validateAuthorization(mockContext, ["internal"], []);
// validateAuthorization(mockContext, ["m2m", "internal", "maintenance"], ["admin"]);
// ^^ no "ui" in the admitted token types, but admittedUiUserRoles is set
