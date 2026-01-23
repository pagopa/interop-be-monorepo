import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import * as jose from "jose";
import {
  JOSEError,
  JWSInvalid,
  JWSSignatureVerificationFailed,
  JWTClaimValidationFailed,
  JWTInvalid,
} from "jose/errors";
import {
  DPoPProof,
  DPoPProofHeader,
  DPoPProofPayload,
  JWKKeyRS256,
  JWKKeyES256,
} from "pagopa-interop-models";

import { calculateKid } from "pagopa-interop-commons";
import {
  dpopJtiAlreadyCached,
  dpopProofInvalidClaims,
  dpopProofSignatureVerificationError,
  invalidDPoPJwt,
  invalidDPoPProofFormat,
  invalidDPoPSignature,
  multipleDPoPProofsError,
  unexpectedDPoPProofError,
  unexpectedDPoPProofSignatureVerificationError,
} from "./errors.js";
import { ValidationResult } from "./types.js";
import { readDPoPCache, writeDPoPCache } from "./utilities/dpopCacheUtils.js";
import {
  failedValidation,
  successfulValidation,
  validateAlgorithm,
  validateHtm,
  validateHtu,
  validateIat,
  validateJti,
  validateJWK,
  validateTyp,
} from "./utilities/utils.js";

export const verifyDPoPProof = ({
  dpopProofJWS,
  expectedDPoPProofHtu,
  dpopProofIatToleranceSeconds,
  dpopProofDurationSeconds,
}: {
  dpopProofJWS: string;
  expectedDPoPProofHtu: string;
  dpopProofIatToleranceSeconds: number;
  dpopProofDurationSeconds: number;
}): ValidationResult<{ dpopProofJWT: DPoPProof; dpopProofJWS: string }> => {
  try {
    if (dpopProofJWS.split(",").length > 1) {
      return failedValidation([multipleDPoPProofsError()]);
    }

    const decodedPayload = jose.decodeJwt(dpopProofJWS);
    const decodedHeader = jose.decodeProtectedHeader(dpopProofJWS);

    // JWT header
    const { errors: typErrors, data: validatedTyp } = validateTyp(
      decodedHeader.typ
    );
    const { errors: jwkErrors, data: validatedJwk } = validateJWK(
      decodedHeader.jwk
    );
    const { errors: algErrors, data: validatedAlg } = validateAlgorithm(
      decodedHeader.alg
    );

    // JWT payload
    const { errors: htmErrors, data: validatedHtm } = validateHtm(
      decodedPayload.htm
    );
    const { errors: htuErrors, data: validatedHtu } = validateHtu(
      decodedPayload.htu,
      expectedDPoPProofHtu
    );
    const { errors: iatErrors, data: validatedIat } = validateIat(
      decodedPayload.iat,
      dpopProofIatToleranceSeconds,
      dpopProofDurationSeconds
    );
    const { errors: jtiErrors, data: validatedJti } = validateJti(
      decodedPayload.jti
    );

    if (
      !typErrors &&
      !algErrors &&
      !jwkErrors &&
      !htmErrors &&
      !htuErrors &&
      !iatErrors &&
      !jtiErrors
    ) {
      const payloadParseResult = DPoPProofPayload.safeParse(decodedPayload);
      const headerParseResult = DPoPProofHeader.safeParse(decodedHeader);
      const parsingErrors = [
        !headerParseResult.success
          ? dpopProofInvalidClaims(headerParseResult.error.message, "header")
          : undefined,
        !payloadParseResult.success
          ? dpopProofInvalidClaims(payloadParseResult.error.message, "payload")
          : undefined,
      ].filter(Boolean);
      if (parsingErrors.length > 0) {
        return failedValidation(parsingErrors);
      }

      const result: DPoPProof = {
        header: {
          typ: validatedTyp,
          alg: validatedAlg,
          jwk: validatedJwk,
        },
        payload: {
          htm: validatedHtm,
          htu: validatedHtu,
          iat: validatedIat,
          jti: validatedJti,
        },
      };
      return successfulValidation({
        dpopProofJWT: result,
        dpopProofJWS,
      });
    }
    return failedValidation([
      typErrors,
      algErrors,
      jwkErrors,
      htmErrors,
      htuErrors,
      iatErrors,
      jtiErrors,
    ]);
  } catch (error) {
    if (error instanceof JWTInvalid) {
      return failedValidation([invalidDPoPProofFormat(error.message)]);
    }
    const message = error instanceof Error ? error.message : "generic error";
    return failedValidation([unexpectedDPoPProofError(message)]);
  }
};

export const verifyDPoPProofSignature = async (
  dpopProofJWS: string,
  jwk: JWKKeyRS256 | JWKKeyES256
): Promise<ValidationResult<jose.JWTPayload>> => {
  try {
    const publicKey = await jose.importJWK(jwk);
    const result = await jose.jwtVerify(dpopProofJWS, publicKey);

    return successfulValidation(result.payload);
  } catch (error: unknown) {
    if (error instanceof JWSSignatureVerificationFailed) {
      return failedValidation([invalidDPoPSignature()]);
    } else if (
      error instanceof JWTClaimValidationFailed ||
      error instanceof JWSInvalid
    ) {
      return failedValidation([invalidDPoPJwt(error.message)]);
    } else if (error instanceof JOSEError) {
      return failedValidation([
        dpopProofSignatureVerificationError(error.message),
      ]);
    } else {
      const message = error instanceof Error ? error.message : "generic error";
      return failedValidation([
        unexpectedDPoPProofSignatureVerificationError(message),
      ]);
    }
  }
};

export const checkDPoPCache = async ({
  dynamoDBClient,
  dpopProofJti,
  dpopProofIat,
  dpopCacheTable,
  dpopProofDurationSeconds,
}: {
  dynamoDBClient: DynamoDBClient;
  dpopProofJti: string;
  dpopProofIat: number;
  dpopCacheTable: string;
  dpopProofDurationSeconds: number;
}): Promise<ValidationResult<string>> => {
  const dpopCache = await readDPoPCache(
    dynamoDBClient,
    dpopProofJti,
    dpopCacheTable
  );
  if (dpopCache) {
    return failedValidation([dpopJtiAlreadyCached(dpopProofJti)]);
  }

  await writeDPoPCache({
    dynamoDBClient,
    dpopCacheTable,
    jti: dpopProofJti,
    iat: dpopProofIat,
    durationSeconds: dpopProofDurationSeconds,
  });

  return successfulValidation(dpopProofJti);
};

/**
 * Verifica il binding crittografico tra la DPoP Proof e l'Access Token.
 * Calcola il thumbprint (jkt) della chiave pubblica presente nella Proof
 * e lo confronta con il la chiave pubblica dell'access Token.
 */
export const verifyDPoPThumbprintMatch = (
  dpopProofJWT: DPoPProof,
  accessTokenJkt: string
): ValidationResult<true> => {
  // 1. Safety Check: La Proof deve esistere (garantito se chiamato dopo validateDPoPProof)
  if (!dpopProofJWT.header.jwk) {
    throw failedValidation([
      unexpectedDPoPProofError("Missing DPoP Proof JWK"),
    ]);
  }

  // 2. Calcolo Thumbprint dalla Chiave Pubblica (Proof)
  // calculateKid normalizza il JWK e calcola l'hash SHA-256 (RFC 7638)
  const proofJkt = calculateKid(dpopProofJWT.header.jwk);

  // 4. Confronto (Binding Check)
  if (proofJkt !== accessTokenJkt) {
    throw failedValidation([
      unexpectedDPoPProofError(
        "DPoP proof public key hash does not match token binding"
      ),
    ]);
  }
  return successfulValidation(true);
};
