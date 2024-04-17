import jwt, { JwtHeader, SigningKeyCallback } from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import { jwtParsingError, missingClaim } from "pagopa-interop-models";
import { JWTConfig, logger } from "../index.js";
import { AuthData, AuthToken, getAuthDataFromToken } from "./authData.js";

export type JWTVerificationResult =
  | {
      valid: true;
    }
  | {
      valid: false;
      error: string;
    };

export const readAuthDataFromJwtToken = (jwtToken: string): AuthData => {
  try {
    const decoded = jwt.decode(jwtToken, { json: true });
    const token = AuthToken.safeParse(decoded);

    if (token.success === false) {
      throw missingClaim(token.error.message);
    } else {
      return getAuthDataFromToken(token.data);
    }
  } catch (err) {
    throw jwtParsingError(err);
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

export const verifyJwtToken = (
  jwtToken: string
): Promise<JWTVerificationResult> => {
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
          logger.warn(`Token verification fails: ${err}`);
          return resolve({
            valid: false,
            error: err.message,
          });
        }
        return resolve({ valid: true });
      }
    );
  });
};

export const hasPermission = (
  permissions: string[],
  authData: AuthData
): boolean =>
  authData.userRoles.some((role: string) => permissions.includes(role));
