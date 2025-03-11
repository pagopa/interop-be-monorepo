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
import { JWTConfig, Logger } from "../index.js";
import { AuthData, AuthToken, getAuthDataFromToken } from "./authData.js";

export const decodeJwtToken = (
  jwtToken: string,
  logger: Logger
): JWTPayload | null => {
  try {
    return decodeJwt(jwtToken);
  } catch (err) {
    logger.error(`Error decoding JWT token: ${err}`);
    throw jwtDecodingError(err);
  }
};

export const readAuthDataFromJwtToken = (
  token: JWTPayload | string
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
): Promise<{ decoded: JWTPayload | string }> => {
  try {
    const { acceptedAudiences } = config;

    const jwtHeader = decodeProtectedHeader(jwtToken);
    if (!jwtHeader?.kid) {
      logger.warn("Token verification failed: missing kid");
      throw invalidClaim("kid");
    }

    // TODO multiple jwks??
    const jwksURL = config.wellKnownUrls[0];

    const jwks = createRemoteJWKSet(new URL(jwksURL));

    await jwtVerify(jwtToken, jwks, {
      audience: acceptedAudiences,
    });
    const decoded = decodeJwtToken(jwtToken, logger);
    if (!decoded) {
      throw new Error("Decoding error");
    }
    return { decoded };
  } catch (error) {
    logger.warn(`Token verification failed: ${error}`);

    const unverifiedDecoded = decodeJwtToken(jwtToken, logger);
    const authData =
      unverifiedDecoded && readAuthDataFromJwtToken(unverifiedDecoded);
    throw tokenVerificationFailed(authData?.userId, authData?.selfcareId);
  }
};

export const hasPermission = (
  permissions: string[],
  authData: AuthData
): boolean =>
  authData.userRoles.some((role: string) => permissions.includes(role));
