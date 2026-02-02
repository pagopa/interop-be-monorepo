import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { JWTConfig, DPoPConfig, Logger } from "pagopa-interop-commons";
import {
  verifyDPoPProof,
  verifyDPoPProofSignature,
  checkDPoPCache,
  verifyDPoPThumbprintMatch,
} from "pagopa-interop-dpop-validation";
import { DPoPProof } from "pagopa-interop-models";
import {
  dpopProofValidationFailed,
  dpopProofSignatureValidationFailed,
  dpopProofJtiAlreadyUsed,
} from "../model/errors.js";

/**
 * Orchestrates the complete validation workflow for a DPoP (Demonstration of Proof-of-Possession) request.
 *
 * This function ensures compliance with RFC 9449 by performing the following checks in order:
 * 1. **Syntax & Crypto**: Validates the DPoP Proof structure, signature, and standard claims (htm, htu, iat).
 * 2. **Replay Protection**: Checks against DynamoDB to ensure the JTI (Unique ID) has not been used recently.
 * 3. **Key Binding**: Verifies that the public key in the DPoP Proof matches the `cnf` claim bound to the Access Token.
 *
 * @param params - The input parameters object.
 * @param params.config - Configuration object containing DPoP settings (cache table name, duration, tolerance).
 * @param params.dpopProofJWS - The raw `DPoP` header string (JWS).
 * @param params.accessTokenClientId - The client ID extracted from the Access Token (used for error contextualization).
 * @param params.accessTokenThumbprint - The expected key thumbprint (`cnf.jkt`) extracted from the Access Token.
 * @param params.expectedHtu - The reconstructed full HTTP URI (HTU) of the incoming request.
 * @param params.expectedHtm - The normalized HTTP Method (HTM) of the incoming request.
 * @param params.dynamoDBClient - The DynamoDB client instance used for JTI cache operations.
 * @param params.logger - Logger instance for tracking validation steps and warnings.
 *
 * @returns A Promise that resolves to the parsed and validated `DPoPProof` object.
 *
 * @throws {dpopProofValidationFailed} If the Proof is missing, malformed, expired, has mismatched HTM/HTU, or fails Key Binding (RFC: invalid_dpop_proof).
 * @throws {dpopProofSignatureValidationFailed} If the cryptographic signature verification fails (RFC: invalid_token).
 * @throws {dpopProofJtiAlreadyUsed} If the JTI has been used previously within the validity window (Replay Attack) (RFC: invalid_dpop_proof).
 */
export const verifyDPoPCompliance = async ({
  config,
  dpopProofJWS,
  accessTokenClientId,
  accessTokenThumbprint,
  expectedHtu,
  expectedHtm,
  dynamoDBClient,
  logger,
}: {
  config: JWTConfig & DPoPConfig;
  dpopProofJWS: string | undefined;
  accessTokenClientId: string;
  accessTokenThumbprint: string;
  expectedHtu: string;
  expectedHtm: string;
  dynamoDBClient: DynamoDBClient;
  logger: Logger;
}): Promise<DPoPProof> => {
  // ----------------------------------------------------------------------
  // Step 1: Parsing & Signature Validation (Static & Crypto)
  // ----------------------------------------------------------------------
  const { dpopProofJWT } = await validateDPoPProof(
    config,
    dpopProofJWS,
    accessTokenClientId,
    expectedHtu,
    expectedHtm,
    logger
  );

  if (!dpopProofJWT) {
    throw dpopProofValidationFailed(
      accessTokenClientId,
      "DPoP Proof missing or invalid"
    );
  }

  // ----------------------------------------------------------------------
  // Step 2: Replay Attack Protection (JTI Cache)
  // ----------------------------------------------------------------------
  const { errors: dpopCacheErrors } = await checkDPoPCache({
    dynamoDBClient,
    dpopProofJti: dpopProofJWT.payload.jti,
    dpopProofIat: dpopProofJWT.payload.iat,
    dpopCacheTable: config.dpopCacheTable,
    dpopProofDurationSeconds: config.dpopDurationSeconds,
  });

  if (dpopCacheErrors) {
    throw dpopProofJtiAlreadyUsed(dpopProofJWT.payload.jti);
  }

  // ----------------------------------------------------------------------
  // Step 3: Key Binding Verification (Thumbprint Match)
  // ----------------------------------------------------------------------
  const { errors: bindingErrors } = verifyDPoPThumbprintMatch(
    dpopProofJWT,
    accessTokenThumbprint
  );

  if (bindingErrors) {
    const errorDetails = bindingErrors.map((e) => e.detail).join(", ");
    logger.warn(`DPoP Key Binding failed: ${errorDetails}`);
    throw dpopProofValidationFailed(accessTokenClientId, errorDetails);
  }

  return dpopProofJWT;
};

/**
 * Internal helper to validate DPoP Proof syntax, standard claims, and signature.
 * Note: Logic duplicated from 'tokenService.ts'. Consider centralization.
 */
const validateDPoPProof = async (
  config: JWTConfig & DPoPConfig,
  dpopProofHeader: string | undefined,
  clientId: string | undefined,
  expectedHtu: string,
  expectedHtm: string,
  logger: Logger
): Promise<{
  dpopProofJWS: string | undefined;
  dpopProofJWT: DPoPProof | undefined;
  // eslint-disable-next-line max-params
}> => {
  const { data, errors: dpopProofErrors } = dpopProofHeader
    ? verifyDPoPProof({
        dpopProofJWS: dpopProofHeader,
        expectedDPoPProofHtu: expectedHtu,
        expectedDPoPProofHtm: expectedHtm,
        dpopProofIatToleranceSeconds: config.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: config.dpopDurationSeconds,
      })
    : { data: undefined, errors: undefined };

  if (dpopProofErrors) {
    throw dpopProofValidationFailed(
      clientId,
      dpopProofErrors.map((error) => error.detail).join(", ")
    );
  }

  const dpopProofJWT = data?.dpopProofJWT;
  const dpopProofJWS = data?.dpopProofJWS;

  if (dpopProofJWT && dpopProofJWS) {
    const { errors: dpopProofSignatureErrors } = await verifyDPoPProofSignature(
      dpopProofJWS,
      dpopProofJWT.header.jwk
    );

    if (dpopProofSignatureErrors) {
      throw dpopProofSignatureValidationFailed(
        clientId,
        dpopProofSignatureErrors.map((error) => error.detail).join(", ")
      );
    }

    logger.info(`[JTI=${dpopProofJWT.payload.jti}] - DPoP proof validated`);
  }

  return { dpopProofJWS, dpopProofJWT };
};
