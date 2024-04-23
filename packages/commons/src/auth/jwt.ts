import jwt, { JwtHeader, JwtPayload, SigningKeyCallback } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { invalidClaim, jwtParsingError } from "pagopa-interop-models";
import { JWTConfig, logger } from "../index.js";
import { AuthData, AuthToken, getAuthDataFromToken } from "./authData.js";

const decodeJwtToken = (jwtToken: string): JwtPayload | null => {
  try {
    return jwt.decode(jwtToken, { json: true });
  } catch (err) {
    throw jwtParsingError(err);
  }
};

export const readAuthDataFromJwtToken = (jwtToken: string): AuthData => {
  const decoded = decodeJwtToken(jwtToken);
  const token = AuthToken.safeParse(decoded);
  if (token.success === false) {
    throw invalidClaim(token.error);
  } else {
    return getAuthDataFromToken(token.data);
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
  const clients = config.wellKnownUrls.map((url) =>
    jwksClient({
      jwksUri: url,
    })
  );
  return new Promise((resolve, _reject) => {
    jwt.verify(
      jwtToken,
      getKey(clients),
      {
        audience: config.acceptedAudiences,
      },
      function (err, _decoded) {
        if (err) {
          logger.warn(`Token verification failed: ${err}`);
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
