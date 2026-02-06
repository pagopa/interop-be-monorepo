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

import { calculateThumbprint } from "pagopa-interop-commons";
import {
  dpopJtiAlreadyCached,
  dpopProofInvalidClaims,
  dpopProofSignatureVerificationError,
  dpopTokenBindingMismatch,
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
  expectedDPoPProofHtm,
  dpopProofIatToleranceSeconds,
  dpopProofDurationSeconds,
}: {
  dpopProofJWS: string;
  expectedDPoPProofHtu: string;
  expectedDPoPProofHtm: string;
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
      decodedPayload.htm,
      expectedDPoPProofHtm
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
 * Verifies the cryptographic binding between the DPoP Proof and the Access Token.
 *
 * This function performs the following checks:
 * - Calculates the JWK Thumbprint (RFC 7638) of the Proof's key.
 * - Compares the calculated thumbprint with the `jkt` hash provided in the Access Token's `cnf` claim.
 *
 */
export const verifyDPoPThumbprintMatch = (
  dpopProofJWT: DPoPProof,
  accessTokenJkt: string
): ValidationResult<true> => {
  const proofJkt = calculateThumbprint(dpopProofJWT.header.jwk);
  if (proofJkt !== accessTokenJkt) {
    return failedValidation([dpopTokenBindingMismatch()]);
  }

  return successfulValidation(true);
};
