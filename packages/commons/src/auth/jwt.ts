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
  CNF,
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

export const readAuthDataFromDPoPJwtToken = (
  payload: JwtPayload | string
): AuthData => {
  // Here we use ONLY the DPoP validator. If 'cnf' is missing, the parse fails.
  const result = AuthTokenDPoPPayload.safeParse(payload);

  if (!result.success) {
    throw invalidClaim(result.error); // Or a specific error "Invalid DPoP Token"
  }
  return getAuthDataFromToken(result.data);
};

export const verifyAccessTokenIsDPoP = (
  payload: JwtPayload | string
): AuthTokenDPoPPayload => {
  const result = AuthTokenDPoPPayload.safeParse(payload);

  if (!result.success) {
    throw invalidClaim(result.error);
  }
  return result.data;
};

// can be used verifyAccessTokenIsDPoP
export const isDPoPToken = (
  input: JwtPayload | string
): input is JwtPayload & typeof CNF =>
  typeof input !== "string" && input.cnf !== undefined && input.cnf !== null;

export const verifyJwtToken = async (
  jwtToken: string,
  config: JWTConfig,
  logger: Logger
  // eslint-disable-next-line sonarjs/cognitive-complexity
): Promise<{ decoded: JwtPayload | string }> => {
  // ONLY for error handling: try to extract user info from token
  // not really need to strict check here, just extract what is possible
  const extractUserInfoForFailedToken = (): AuthDataUserInfo => {
    try {
      const decoded = decodeJwtToken(jwtToken, logger);
      if (!decoded) {
        logger.warn("Failed to decode JWT token");
        return getUserInfoFromAuthData(undefined);
      }
      try {
        const authData = isDPoPToken(decoded)
          ? readAuthDataFromDPoPJwtToken(decoded)
          : readAuthDataFromJwtToken(decoded);
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
