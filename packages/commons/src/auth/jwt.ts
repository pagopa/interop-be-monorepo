import jwt, { GetPublicKeyOrSecret, JwtPayload } from "jsonwebtoken";
import {
  invalidClaim,
  jwksSigningKeyError,
  jwtDecodingError,
  tokenVerificationFailed,
} from "pagopa-interop-models";
import { Logger } from "../logging/index.js";
import { JWTConfig } from "../config/httpServiceConfig.js";
import {
  AuthTokenDPoPPayload,
  AuthTokenPayload,
} from "../interop-token/models.js";
import { buildJwksClients } from "./jwk.js";
import {
  AuthData,
  AuthDataUserInfo,
  getAuthDataFromToken,
  getUserInfoFromAuthData,
} from "./authData.js";

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
  payload: JwtPayload | string
): AuthData => {
  const authTokenPayload = AuthTokenPayload.safeParse(payload);
  if (authTokenPayload.success === false) {
    throw invalidClaim(authTokenPayload.error);
  } else {
    return getAuthDataFromToken(authTokenPayload.data);
  }
};

/**
 * Enforces DPoP schema compliance using Zod, strictly validating the `cnf` claim structure.
 */
const verifyAccessTokenIsDPoP = (
  payload: JwtPayload | string
): AuthTokenDPoPPayload => {
  const result = AuthTokenDPoPPayload.safeParse(payload);

  if (!result.success) {
    throw invalidClaim(result.error);
  }
  return result.data;
};

/**
 * Verifies the cryptographic integrity and standard claims (exp, aud) of a JWT Access Token.
 * It retrieves the public key via the configured JWKS providers and validates the signature.
 */
export const verifyJwtToken = async (
  jwtToken: string,
  config: JWTConfig,
  logger: Logger
  // eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<{ decoded: JwtPayload | string }> => {
  const extractUserInfoForFailedToken = (): AuthDataUserInfo => {
    try {
      const decoded = decodeJwtToken(jwtToken, logger);
      if (!decoded) {
        logger.warn("Failed to decode JWT token");
        return getUserInfoFromAuthData(undefined);
      }

      try {
        const authData = readAuthDataFromJwtToken(decoded);
        return getUserInfoFromAuthData(authData);
      } catch (authDataError) {
        logger.warn(`Invalid auth data from JWT token: ${authDataError}`);
        return getUserInfoFromAuthData(undefined);
      }
    } catch (decodeError) {
      logger.warn(`Error decoding JWT token: ${decodeError}`);
      return getUserInfoFromAuthData(undefined);
    }
  };

  try {
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
      })().catch(callback);
    };

    return new Promise((resolve, reject) => {
      jwt.verify(
        jwtToken,
        getSecret,
        { audience: config.acceptedAudiences },
        (err, decoded) => {
          if (err || !decoded) {
            logger.warn(`Token verification failed: ${err}`);
            const { userId, selfcareId } = extractUserInfoForFailedToken();
            return reject(tokenVerificationFailed(userId, selfcareId));
          }
          return resolve({ decoded });
        }
      );
    });
  } catch (error) {
    logger.error(`Error verifying JWT token: ${error}`);
    const { userId, selfcareId } = extractUserInfoForFailedToken();
    return Promise.reject(tokenVerificationFailed(userId, selfcareId));
  }
};

/**
 * Verifies the cryptographic integrity and DPoP compliance of an Access Token.
 *
 * This function performs a two-step validation:
 * 1. **Standard Verification**: Validates signature, expiration, and audience.
 * 2. **DPoP Binding Check**: Validates that the payload conforms to JWT DPoP bound.
 *
 * If the token is cryptographically valid but fails the DPoP schema check (e.g., missing `cnf`),
 * it catches the validation error, attempts to extract user context for auditing, and throws an error
 *
 */
export const verifyJwtDPoPToken = async (
  accessToken: string,
  config: JWTConfig,
  logger: Logger
): Promise<AuthTokenDPoPPayload> => {
  const { decoded } = await verifyJwtToken(accessToken, config, logger);
  try {
    return verifyAccessTokenIsDPoP(decoded);
  } catch (error) {
    logger.warn(
      `Token verified (cryptographically valid) but DPoP structure check failed: ${error}`
    );
    // eslint-disable-next-line @typescript-eslint/explicit-function-return-type
    const { userId, selfcareId } = (() => {
      try {
        return getUserInfoFromAuthData(readAuthDataFromJwtToken(decoded));
      } catch (e) {
        logger.debug(`Could not extract user info from validated token: ${e}`);
        return { userId: undefined, selfcareId: undefined };
      }
    })();

    throw tokenVerificationFailed(userId, selfcareId);
  }
};
