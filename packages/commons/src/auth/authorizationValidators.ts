import { operationForbidden } from "pagopa-interop-models";
import { AuthData } from "./authData.js";

export function assertAuthDataIs<T extends AuthData["tokenType"]>(
  authData: AuthData,
  tokenType: T
): asserts authData is Extract<AuthData, { tokenType: T }> {
  if (authData.tokenType !== tokenType) {
    throw operationForbidden;
  }
}

export function assertAuthDataIsOneOf<T extends Array<AuthData["tokenType"]>>(
  authData: AuthData,
  tokenTypes: T
): asserts authData is Extract<AuthData, { tokenType: T[number] }> {
  if (!tokenTypes.includes(authData.tokenType)) {
    throw operationForbidden;
  }
}
