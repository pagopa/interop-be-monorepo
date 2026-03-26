import {
  decodeJwt,
  decodeProtectedHeader,
  JWTPayload,
  createRemoteJWKSet,
  jwtVerify,
} from "jose";
import {
  invalidClaim,
  jwtDecodingError,
  tokenVerificationFailed,
} from "pagopa-interop-models";
import { Logger } from "../logging/index.js";
import { JWTConfig } from "../config/httpServiceConfig.js";
import {
  AuthTokenDPoPPayload,
  AuthTokenPayload,
} from "../interop-token/models.js";
import {
  AuthData,
  AuthDataUserInfo,
  getAuthDataFromToken,
  getUserInfoFromAuthData,
} from "./authData.js";

export const decodeJwtToken = (
  jwtToken: string,
  logger: Logger
): JWTPayload => {
  try {
    return decodeJwt(jwtToken);
  } catch (err) {
    logger.error(`Error decoding JWT token: ${err}`);
    throw jwtDecodingError(err);
  }
};

export const readAuthDataFromJwtToken = (
  payload: JWTPayload | string
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
  payload: JWTPayload | string
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
): Promise<{ decoded: JWTPayload | string }> => {
  const extractUserInfoForFailedToken = (): AuthDataUserInfo => {
    try {
      const decoded = decodeJwtToken(jwtToken, logger);
      const authData = readAuthDataFromJwtToken(decoded);
      return getUserInfoFromAuthData(authData);
    } catch (error) {
      logger.warn(`Could not extract user info from JWT token: ${error}`);
      return getUserInfoFromAuthData(undefined);
    }
  };

  try {
    const { acceptedAudiences } = config;

    const jwtHeader = decodeProtectedHeader(jwtToken);
    if (!jwtHeader?.kid) {
      logger.warn("Token verification failed: missing kid");
      throw invalidClaim("kid");
    }

    const jwksClients = config.wellKnownUrls.map((url) =>
      createRemoteJWKSet(new URL(url))
    );

    const decoded = await Promise.any(
      jwksClients.map(async (jwksClient) => {
        const { payload } = await jwtVerify(jwtToken, jwksClient, {
          audience: acceptedAudiences,
        });
        return payload;
      })
    ).catch(() => {
      throw new Error("No JWKS client could verify the token");
    });

    return { decoded };
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
