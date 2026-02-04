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
  dpopTokenBindingFailed,
} from "../model/errors.js";

/**
 * Orchestrates the complete validation workflow for a DPoP (Demonstration of Proof-of-Possession) request.
 *
 * This function ensures compliance with RFC 9449 by performing the following checks in order:
 * 1. **Syntax Validation**: Validates the DPoP Proof structure and standard claims (htm, htu, iat).
 * 2. **Signature Verification**: Verifies the cryptographic signature of the JWS.
 * 3. **Key Binding**: Verifies that the public key in the DPoP Proof matches the `cnf` claim bound to the Access Token.
 * 4. **Replay Protection**: Checks against DynamoDB to ensure the JTI (Unique ID) has not been used recently.
 *
 * NB: every function is tested separately in dpop-validation package; this function mainly orchestrates the calls and error handling.
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
  // Step 1: Parsing & Syntax Validation
  // ----------------------------------------------------------------------
  const { data, errors: dpopProofErrors } = dpopProofJWS
    ? verifyDPoPProof({
        dpopProofJWS,
        expectedDPoPProofHtu: expectedHtu,
        expectedDPoPProofHtm: expectedHtm,
        dpopProofIatToleranceSeconds: config.dpopIatToleranceSeconds,
        dpopProofDurationSeconds: config.dpopDurationSeconds,
      })
    : { data: undefined, errors: undefined };

  if (dpopProofErrors) {
    throw dpopProofValidationFailed(
      accessTokenClientId,
      dpopProofErrors.map((error) => error.detail).join(", ")
    );
  }

  const validatedJWT = data?.dpopProofJWT;
  const validatedJWS = data?.dpopProofJWS;

  if (!validatedJWT || !validatedJWS) {
    throw dpopProofValidationFailed(
      accessTokenClientId,
      "DPoP Proof missing or invalid"
    );
  }

  // ----------------------------------------------------------------------
  // Step 2: Signature Validation
  // ----------------------------------------------------------------------
  const { errors: dpopProofSignatureErrors } = await verifyDPoPProofSignature(
    validatedJWS,
    validatedJWT.header.jwk
  );

  if (dpopProofSignatureErrors) {
    throw dpopProofSignatureValidationFailed(
      accessTokenClientId,
      dpopProofSignatureErrors.map((error) => error.detail).join(", ")
    );
  }

  logger.info(`[DPOPJTI=${validatedJWT.payload.jti}] - DPoP proof validated`);

  // ----------------------------------------------------------------------
  // Step 3: Key Binding Verification (Thumbprint Match)
  // ----------------------------------------------------------------------
  const { errors: bindingErrors } = verifyDPoPThumbprintMatch(
    validatedJWT,
    accessTokenThumbprint
  );

  if (bindingErrors) {
    const errorDetails = bindingErrors.map((e) => e.detail).join(", ");
    logger.warn(`DPoP Key Binding verification failed: ${errorDetails}`);
    throw dpopTokenBindingFailed(accessTokenClientId, errorDetails);
  }

  // ----------------------------------------------------------------------
  // Step 4: Replay Attack Protection (JTI Cache)
  // ----------------------------------------------------------------------
  const { errors: dpopCacheErrors } = await checkDPoPCache({
    dynamoDBClient,
    dpopProofJti: validatedJWT.payload.jti,
    dpopProofIat: validatedJWT.payload.iat,
    dpopCacheTable: config.dpopCacheTable,
    dpopProofDurationSeconds: config.dpopDurationSeconds,
  });

  if (dpopCacheErrors) {
    throw dpopProofJtiAlreadyUsed(validatedJWT.payload.jti);
  }

  return validatedJWT;
};
