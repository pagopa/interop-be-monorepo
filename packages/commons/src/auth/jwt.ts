import jwt, { GetPublicKeyOrSecret, JwtPayload } from "jsonwebtoken";
import {
  invalidClaim,
  jwksSigningKeyError,
  jwtDecodingError,
  tokenVerificationFailed,
} from "pagopa-interop-models";
import { P, match } from "ts-pattern";
import { buildJwksClients, JWTConfig, Logger } from "../index.js";
import { AuthData, AuthToken, getAuthDataFromToken } from "./authData.js";

export const decodeJwtToken = (
  jwtToken: string,
  logger: Logger
): JwtPayload | null => {
  try {
    return jwt.decode(jwtToken, { json: true });
  } catch (err) {
    logger.error(`Error decoding JWT token: ${err}`);
    throw jwtDecodingError(err);
  }
};

export const readAuthDataFromJwtToken = (
  token: JwtPayload | string
): AuthData => {
  const authToken = AuthToken.safeParse(token);
  if (authToken.success === false) {
    throw invalidClaim(authToken.error);
  } else {
    return getAuthDataFromToken(authToken.data);
  }
};

export const verifyJwtToken = async (
  jwtToken: string,
  config: JWTConfig,
  logger: Logger
): Promise<{ decoded: JwtPayload | string }> => {
  try {
    const { acceptedAudiences } = config;
    const jwksClients = buildJwksClients(config);
    /**
     * This function is a callback used by the `jwt.verify` function to retrieve the public key
     * associated with a given JWT token.
     */
    const getSecret: GetPublicKeyOrSecret = (header, callback) => {
      if (!header.kid) {
        return callback(invalidClaim("kid"));
      }

      logger.debug(`Getting public key for kid ${header.kid}`);

      // Use an IIFE (Immediately Invoked Function Expression) to handle the asynchronous operations.
      // The IIFE is used to make the `getSecret` callback asynchronous, because the `jwt.verify` function
      // expects a synchronous callback. The IIFE is needed to handle the case where the `getSigningKey`
      // function of the jwksClient returns a promise.
      (async (): Promise<void> => {
        for (const client of jwksClients) {
          try {
            const signingKey = await client.getSigningKey(header.kid);
            return callback(null, signingKey.getPublicKey());
          } catch (error) {
            logger.debug(`Skip Jwks client: ${error}`);
          }
        }
        logger.error(`Error getting public key`);
        return callback(jwksSigningKeyError());
      })().catch((error) => callback(error));
    };

    return new Promise((resolve, reject) => {
      jwt.verify(
        jwtToken,
        getSecret,
        { audience: acceptedAudiences },
        (err, decoded) => {
          if (err || !decoded) {
            logger.warn(`Token verification failed: ${err}`);

            const unverifiedDecoded = decodeJwtToken(jwtToken, logger);
            const authData =
              unverifiedDecoded && readAuthDataFromJwtToken(unverifiedDecoded);

            reject(
              match(authData)
                .with({ tokenType: "ui" }, ({ userId, selfcareId }) =>
                  tokenVerificationFailed(userId, selfcareId)
                )
                .with(P.not({ tokenType: "ui" }), () =>
                  tokenVerificationFailed(undefined, undefined)
                )
                .exhaustive()
            );
          } else {
            resolve({ decoded });
          }
        }
      );
    });
  } catch (error) {
    logger.error(`Error verifying JWT token: ${error}`);
    return Promise.reject(error);
  }
};
