import jwt, { JwtHeader, JwtPayload, SigningKeyCallback } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { invalidClaim, jwtDecodingError } from "pagopa-interop-models";
import { JWTConfig, Logger } from "../index.js";
import { AuthData, AuthToken, getAuthDataFromToken } from "./authData.js";

export const decodeJwtToken = (jwtToken: string): JwtPayload | null => {
  try {
    return jwt.decode(jwtToken, { json: true });
  } catch (err) {
    throw jwtDecodingError(err);
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
    clients: jwksClient.JwksClient[],
    logger: Logger
  ): ((header: JwtHeader, callback: SigningKeyCallback) => void) =>
  (header, callback) => {
    // eslint-disable-next-line functional/no-let
    let responseReceived = 0;
    for (const client of clients) {
      client.getSigningKey(header.kid, function (err, key) {
        responseReceived = responseReceived + 1;
        if (err && responseReceived === clients.length) {
          logger.error(`Error getting signing key: ${err}`);
          return callback(err, undefined);
        } else {
          return callback(null, key?.getPublicKey());
        }
      });
    }
  };

export const verifyJwtToken = (
  jwtToken: string,
  logger: Logger
): Promise<boolean> => {
  const config = JWTConfig.parse(process.env);
  const clients = config.wellKnownUrls.map((url) =>
    jwksClient({
      jwksUri: url,
    })
  );
  return new Promise((resolve, _reject) => {
    jwt.verify(
      jwtToken,
      getKey(clients, logger),
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
