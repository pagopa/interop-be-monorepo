/* eslint-disable max-params */
import { Algorithm, JwtHeader, JwtPayload } from "jsonwebtoken";
import { tokenGenerationError } from "pagopa-interop-models";
import { v4 as uuidv4 } from "uuid";
import { logger, signerConfig } from "../../index.js";
import { userRoles } from "../authData.js";
import { buildSignerService } from "../signerService.js";
import { InternalToken, TokenSeed, TokenPayloadSeed } from "./token.js";

export type InteropTokenGenerator = {
  generateInternalToken: (seed: TokenPayloadSeed) => Promise<InternalToken>;
};

const createInternalToken = (
  algorithm: Algorithm,
  kid: string,
  subject: string,
  audience: string[],
  tokenIssuer: string,
  validityDurationSeconds: number
): TokenSeed => {
  const issuedAt = new Date().getTime() / 1000;
  const expireAt = validityDurationSeconds * 1000 + issuedAt;

  return {
    id: uuidv4(),
    algorithm,
    kid,
    subject,
    issuer: tokenIssuer,
    issuedAt,
    nbf: issuedAt,
    expireAt,
    audience,
    customClaims: new Map([["role", userRoles.INTERNAL_ROLE]]),
  };
};

export const buildInteropTokenGenerator = (): InteropTokenGenerator => {
  // Hosting all the dependencies to collect all process env reading at one time
  const signerService = buildSignerService();
  const { rsaKeysIdentifiers } = signerConfig();

  const createSignedJWT = async (
    seed: TokenSeed,
    kid: string
  ): Promise<string> => {
    const customHeaders = { use: "sig" };
    const jwtHeaders: JwtHeader = {
      alg: seed.algorithm,
      kid: seed.kid,
      typ: "at+jwt",
    };

    const headers = { ...jwtHeaders, ...customHeaders };

    const payload: JwtPayload = {
      ...seed.customClaims,
      jti: seed.id,
      iss: seed.issuer,
      aud: seed.audience,
      sub: seed.subject,
      iat: seed.issuedAt,
      nbf: seed.nbf,
      exp: seed.expireAt,
    };

    const encodedHeader = Buffer.from(JSON.stringify(headers)).toString(
      "base64url"
    );
    const encodedPayload = Buffer.from(JSON.stringify(payload)).toString(
      "base64url"
    );
    const serializedToken = `${encodedHeader}.${encodedPayload}`;
    const signature = await signerService.signWithRSA256(kid, serializedToken);

    logger.info(`Interop internal Token generated`);
    return `${serializedToken}.${signature}`;
  };

  const generateInternalToken = async (
    tokenPayloadSeed: TokenPayloadSeed
  ): Promise<InternalToken> => {
    try {
      const privateKid =
        rsaKeysIdentifiers[
          Math.floor(Math.random() * rsaKeysIdentifiers.length)
        ];

      const tokenSeed = createInternalToken(
        "RS256",
        privateKid,
        tokenPayloadSeed.subject,
        tokenPayloadSeed.audience,
        tokenPayloadSeed.tokenIssuer,
        tokenPayloadSeed.secondsToExpire
      );

      const signedJwt = await createSignedJWT(tokenSeed, privateKid);

      return {
        serialized: signedJwt,
        jti: tokenSeed.id,
        iat: tokenSeed.issuedAt,
        exp: tokenSeed.expireAt,
        nbf: tokenSeed.nbf,
        expIn: tokenPayloadSeed.secondsToExpire,
        alg: "RS256",
        kid: privateKid,
        aud: tokenSeed.audience,
        sub: tokenSeed.subject,
        iss: tokenSeed.issuer,
      };
    } catch (error) {
      throw tokenGenerationError(error);
    }
  };

  return {
    generateInternalToken,
  };
};
