import jwt, { JwtHeader, SigningKeyCallback } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { unsafeBrandId } from "pagopa-interop-models";
import { JWTConfig, logger } from "../index.js";
import { AuthData, AuthToken, UserRoles } from "./authData.js";

const getUserRoles = (token: AuthToken): UserRoles[] => {
  const roleFromInteropClaim = token.role;
  if (roleFromInteropClaim !== undefined) {
    return [roleFromInteropClaim];
  }

  const userRolesFromInteropClaim = token["user-roles"];
  if (
    userRolesFromInteropClaim !== undefined &&
    userRolesFromInteropClaim.length !== 0
  ) {
    return userRolesFromInteropClaim;
  }

  const userRolesFromOrganizationClaim = token.organization?.roles.map(
    (role) => role.role
  );

  if (
    userRolesFromOrganizationClaim !== undefined &&
    userRolesFromOrganizationClaim.length !== 0
  ) {
    return userRolesFromOrganizationClaim;
  }

  logger.warn(`Unable to extract userRoles from claims`); // TODO: improve error logging
  return [];
};

export const readAuthDataFromJwtToken = (
  jwtToken: string
): AuthData | Error => {
  try {
    const decoded = jwt.decode(jwtToken, { json: true });
    const token = AuthToken.safeParse(decoded);

    if (token.success === false) {
      logger.error(`Error parsing token: ${JSON.stringify(token.error)}`);
      return new Error(token.error.message);
    } else {
      return {
        organizationId: token.data.organizationId ?? unsafeBrandId(""), // TODO improve
        userId: token.data.uid ?? "",
        userRoles: getUserRoles(token.data),
        externalId: token.data.externalId ?? { origin: "", value: "" },
      };
    }
  } catch (err) {
    logger.error(`Unexpected error parsing token: ${err}`);
    return new Error(`Unexpected error parsing token: ${err}`);
  }
};

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

export const verifyJwtToken = (jwtToken: string): Promise<boolean> => {
  const config = JWTConfig.parse(process.env);
  const clients = !config.skipJWTVerification
    ? config.wellKnownUrls.map((url) =>
        jwksClient({
          jwksUri: url,
        })
      )
    : undefined;
  return clients === undefined
    ? Promise.resolve(true)
    : new Promise((resolve, _reject) => {
        jwt.verify(
          jwtToken,
          getKey(clients),
          undefined,
          function (err, _decoded) {
            if (err) {
              logger.error(`Error verifying token: ${err}`);
              return resolve(false);
            }
            return resolve(true);
          }
        );
      });
};

export const hasPermission = (
  permissions: string[],
  authData: AuthData
): boolean =>
  authData.userRoles.some((role: string) => permissions.includes(role));
