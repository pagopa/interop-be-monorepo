import jwt, { JwtHeader, SigningKeyCallback } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { commonConfig } from "../config/commonConfig.js";
import { logger } from "../index.js";
import { AuthData, AuthJWTToken } from "./authData.js";

const config = commonConfig();

const getUserRoles = (token: AuthJWTToken): string[] => {
  const rolesFromInteropClaim = token.role;
  if (
    rolesFromInteropClaim !== undefined &&
    rolesFromInteropClaim.length !== 0
  ) {
    return rolesFromInteropClaim;
  }

  const userRolesStringFromInteropClaim = token["user-roles"];
  if (
    userRolesStringFromInteropClaim !== undefined &&
    userRolesStringFromInteropClaim.length !== 0
  ) {
    return userRolesStringFromInteropClaim;
  }

  const userRolesStringFromOrganizationClaim = token.organization.roles.map(
    (role) => role.role
  );

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
        userId: token.data.uid !== undefined ? token.data.uid : "",
        userRoles: getUserRoles(token.data),
        externalId: token.data.externalId,
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

const getKey =
  (
    clients: jwksClient.JwksClient[]
  ): ((header: JwtHeader, callback: SigningKeyCallback) => void) =>
  (header, callback) => {
    for (const { client, last } of clients.map((c, i) => ({
      client: c,
      last: i === clients.length - 1,
    }))) {
      client.getSigningKey(header.kid, function (err, key) {
        if (err && last) {
          logger.error(`Error getting signing key: ${err}`);
          return callback(err, undefined);
        } else {
          return callback(null, key?.getPublicKey());
        }
      });
    }
  };

export const verifyJwtToken = (jwtToken: string): Promise<boolean> =>
  new Promise((resolve, _reject) => {
    jwt.verify(jwtToken, getKey(clients), undefined, function (err, _decoded) {
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
