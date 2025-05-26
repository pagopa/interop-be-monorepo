import {
  DPoPProof,
  DPoPProofPayload,
  DPoPProofHeader,
  JWKKey,
  JWKKeyES,
} from "pagopa-interop-models";
import * as jose from "jose";
import {
  JOSEError,
  JWSInvalid,
  JWSSignatureVerificationFailed,
  JWTClaimValidationFailed,
  JWTExpired,
  JWTInvalid,
} from "jose/errors";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  failedValidation,
  successfulValidation,
  validateTyp,
  validateAlgorithm,
  validateJWK,
  validateHtm,
  validateHtu,
  validateIat,
  validateJti,
} from "./utilities/utils.js";
import { ValidationResult } from "./types.js";
import {
  dPoPProofInvalidClaims,
  dPoPProofSignatureVerificationError,
  invalidDPoPProofFormat,
  jsonWebTokenError,
  notBeforeError,
  tokenExpiredError,
  invalidDPoPSignature,
  unexpectedDPoPProofError,
  unexpectedDPoPProofSignatureVerificationError,
  dpopJTIAlreadyCached,
} from "./errors.js";
import { readDPoPCache } from "./utilities/dPoPCacheUtils.js";

export const verifyDPoPProof = ({
  dPoPProof,
  expectedDPoPProofHtu,
}: {
  dPoPProof: string | unknown[];
  expectedDPoPProofHtu: string;
}): ValidationResult<{ dPoPProofJWT: DPoPProof; dPoPProofJWS: string }> => {
  if (Array.isArray(dPoPProof)) {
    // TODO: double check if this works
    return failedValidation([
      invalidDPoPProofFormat("multiple DPoP proof headers"),
    ]);
  }

  try {
    const decodedPayload = jose.decodeJwt(dPoPProof);
    const decodedHeader = jose.decodeProtectedHeader(dPoPProof);

    // JWT header
    const { errors: typErrors, data: validatedTyp } = validateTyp(
      decodedHeader.typ
    );
    const { errors: jwkErrors, data: validatedJwk } = validateJWK(
      decodedHeader.jwk
    );
    const { errors: algErrors, data: validatedAlg } = validateAlgorithm(
      decodedHeader.alg,
      validatedJwk?.alg
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
      decodedPayload.iat
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
      if (!payloadParseResult.success) {
        return failedValidation([
          dPoPProofInvalidClaims(payloadParseResult.error.message),
        ]);
      }

      const headerParseResult = DPoPProofHeader.safeParse(decodedHeader);
      if (!headerParseResult.success) {
        return failedValidation([
          dPoPProofInvalidClaims(headerParseResult.error.message),
        ]);
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
        dPoPProofJWT: result,
        dPoPProofJWS: dPoPProof,
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
  dPoPProofJWS: string,
  jwk: JWKKey | JWKKeyES
): Promise<ValidationResult<jose.JWTPayload>> => {
  try {
    const publicKey = await jose.importJWK(jwk, jwk.alg);
    const result = await jose.jwtVerify(dPoPProofJWS, publicKey, {
      algorithms: [jwk.alg],
    });

    return successfulValidation(result.payload);
  } catch (error: unknown) {
    if (error instanceof JWTExpired) {
      return failedValidation([tokenExpiredError()]);
    } else if (error instanceof JWSSignatureVerificationFailed) {
      return failedValidation([invalidDPoPSignature()]);
    } else if (error instanceof JWTClaimValidationFailed) {
      if (error.claim === "nbf") {
        return failedValidation([notBeforeError()]);
      }
      return failedValidation([jsonWebTokenError(error.message)]);
    } else if (error instanceof JWSInvalid) {
      return failedValidation([jsonWebTokenError(error.message)]);
    } else if (error instanceof JOSEError) {
      return failedValidation([
        dPoPProofSignatureVerificationError(error.message),
      ]);
    } else {
      const message = error instanceof Error ? error.message : "generic error";
      return failedValidation([
        unexpectedDPoPProofSignatureVerificationError(message),
      ]);
    }
  }
};

export const checkDPoPCache = async (
  dynamoDBClient: DynamoDBClient,
  dPoPProofJti: string,
  dPoPCacheTable: string
): Promise<ValidationResult<string>> => {
  const dPoPCache = await readDPoPCache(
    dynamoDBClient,
    dPoPProofJti,
    dPoPCacheTable
  );
  if (dPoPCache) {
    return failedValidation([dpopJTIAlreadyCached(dPoPProofJti)]);
  }

  return successfulValidation(dPoPProofJti);
};
