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

// verify with AuthTokenDPoPPayload schema
// if not necessary use verifyAccessTokenIsDPoP instead
// and DELETE type/schema AuthTokenDPoPPayload
export const verifyAccessTokenIsDPoP = (
  payload: JwtPayload | string
): AuthTokenDPoPPayload => {
  const result = AuthTokenDPoPPayload.safeParse(payload);

  if (!result.success) {
    throw invalidClaim(result.error);
  }
  return result.data;
};

// export const isAccessTokenDPoPBound = (
//   input: JwtPayload | string
// ): input is JwtPayload & typeof CNF =>
//   typeof input !== "string" && input.cnf !== undefined && input.cnf !== null;

/**
 * Verifies the cryptographic integrity and validity of a JWT Access Token.
 *
 * This function performs the following checks:
 * 1. **Signature Verification**: Retrieves the public key from the configured JWKS providers
 * (supporting multiple clients/key rotation) matching the token's `kid` header.
 * 2. **Standard Claims Validation**: Checks that the token is not expired (`exp`) and matches the expected audience (`aud`).
 *
 * @remarks
 * If verification fails (due to invalid signature, expiration, or missing keys), this function
 * attempts to insecurely decode the token payload solely to extract context (`userId`, `selfcareId`)
 * to populate the thrown `tokenVerificationFailed` error for better auditing.
 *
 * @param jwtToken - The raw Base64 encoded JWT string.
 * @param config - Configuration object containing accepted audiences and JWKS URL(s).
 * @param logger - Logger instance for debug and error tracking.
 *
 * @returns A Promise that resolves to an object containing the `decoded` payload if verification is successful.
 *
 * @throws {tokenVerificationFailed} If the token is invalid, expired, tampered with, or if the signing key cannot be found.
 * The error object includes user context if extractable.
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
 * Orchestrates the complete verification of a DPoP-bound Access Token.
 *
 * This function combines two validation steps:
 * 1. **Standard JWT Verification**: Validates the cryptographic signature, expiration (`exp`),
 * and standard claims using `verifyJwtToken`.
 * 2. **DPoP Structure Enforcement**: Ensures the token payload complies with the DPoP schema,
 * specifically checking for the presence of the confirmation claim (`cnf`) using `verifyAccessTokenIsDPoP`.
 *
 * @param accessToken - The raw Base64 encoded JWT string extracted from the Authorization header.
 * @param config - The JWT configuration object containing keys and validation options.
 * @param logger - The logger instance used for tracking validation steps.
 *
 * @returns A Promise that resolves to the decoded token payload, strictly typed as `AuthTokenDPoPPayload`.
 * This guarantees to the consumer that the `cnf` property is present and valid.
 *
 * @throws {tokenVerificationFailed} If the token signature is invalid, expired, or the token is malformed (HTTP 401).
 * @throws {invalidClaim} If the token is cryptographically valid but misses required DPoP claims (e.g., missing `cnf`) (HTTP 400).
 */
export const verifyJwtDPoPToken = async (
  accessToken: string,
  config: JWTConfig,
  logger: Logger
): Promise<AuthTokenDPoPPayload> => {
  // Verify JWT Signature & Expiration
  const { decoded } = await verifyJwtToken(accessToken, config, logger);

  // Step 2: Enforce DPoP Structure
  // throws 'invalidClaim' (400) if DPoP claims are missing or malformed (cnf included)
  return verifyAccessTokenIsDPoP(decoded);
};
