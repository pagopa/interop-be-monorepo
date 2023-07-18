import { decode } from "jsonwebtoken";
import { logger } from "../index.js";
import { AuthData, AuthJWTToken } from "./authData.js";

const getUserRoles = (token: AuthJWTToken): string[] => {
  const rolesFromInteropClaim = token.data.role.split(",");
  if (rolesFromInteropClaim !== 0) {
    return rolesFromInteropClaim;
  }

  const userRolesStringFromInteropClaim = token.data["user-roles"].split(",");
  if (userRolesStringFromInteropClaim !== 0) {
    return userRolesStringFromInteropClaim;
  }

  const userRolesStringFromOrganizationClaim =
    token.data.organization.roles.split(",");

  if (userRolesStringFromOrganizationClaim !== 0) {
    return userRolesStringFromOrganizationClaim;
  }

  logger.warn(`Unable to extract userRoles from claims`); // TODO: improve error logging
  return [];
};

export const readAuthDataFromJwtToken = (
  jwtToken: string
): AuthData | Error => {
  const decoded = decode(jwtToken, { json: true });
  const token = AuthJWTToken.safeParse(decoded);

  if (token.success === false) {
    logger.error(`Error parsing token: ${JSON.stringify(token.error)}`);
    return new Error(token.error.message);
  } else {
    return {
      organizationId: token.data.organizationId,
      userId: token.data.sub,
      userRoles: getUserRoles(token.data),
    };
  }
};

export const hasPermission = (
  permissions: string[],
  authData: AuthData
): boolean =>
  authData.userRoles.some((role: string) => permissions.includes(role));
