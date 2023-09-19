import jwt, { JwtHeader, SigningKeyCallback } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { config, logger } from "../index.js";
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

const clients = config.wellKnownUrls.map((url) =>
  jwksClient({
    jwksUri: url,
  })
);

const getKey = (header: JwtHeader, callback: SigningKeyCallback): void => {
  // eslint-disable-next-line functional/no-let
  let lastErr = null;

  for (const client of clients) {
    client.getSigningKey(header.kid, function (err, key) {
      if (err) {
        lastErr = err;
      } else {
        return callback(null, key?.getPublicKey());
      }
    });
  }
  if (lastErr) {
    logger.error(`Error getting signing key: ${lastErr}`);
    return callback(lastErr, undefined);
  }
};

export const verifyJwtToken = (jwtToken: string): Promise<boolean> =>
  new Promise((resolve, _reject) => {
    jwt.verify(jwtToken, getKey, {}, function (err, _decoded) {
      if (err) {
        logger.error(`Error verifying token: ${err}`);
        return resolve(false);
      }
      return resolve(true);
    });
  });

export const hasPermission = (
  permissions: string[],
  authData: AuthData
): boolean =>
  authData.userRoles.some((role: string) => permissions.includes(role));
