import jwt from "jsonwebtoken";
import { logger } from "../index.js";
import { AuthData, AuthJWTToken } from "./authData.js";

const getUserRoles = (token: AuthJWTToken): string[] => {
  const rolesFromInteropClaim = token.role.split(",");
  if (rolesFromInteropClaim.length !== 0) {
    return rolesFromInteropClaim;
  }

  const userRolesStringFromInteropClaim = token["user-roles"].split(",");
  if (userRolesStringFromInteropClaim.length !== 0) {
    return userRolesStringFromInteropClaim;
  }

  const userRolesStringFromOrganizationClaim =
    token.data.organization.roles.split(",");

  if (userRolesStringFromOrganizationClaim.length !== 0) {
    return userRolesStringFromOrganizationClaim;
  }

  logger.warn(`Unable to extract userRoles from claims`); // TODO: improve error logging
  return [];
};

export const readAuthDataFromJwtToken = (
  jwtToken: string
): AuthData | Error => {
  try {
    const decoded = jwt.decode(jwtToken, { json: true });
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
  } catch (err) {
    logger.error(`Unexpected error parsing token: ${err}`);
    return new Error(`Unexpected error parsing token: ${err}`);
  }
};

export const hasPermission = (
  permissions: string[],
  authData: AuthData
): boolean =>
  authData.userRoles.some((role: string) => permissions.includes(role));
